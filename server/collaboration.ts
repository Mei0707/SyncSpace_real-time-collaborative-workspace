import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import * as Y from "yjs";
import type { AuthUser } from "./auth";
import { getUserBySessionToken, getWorkspaceMembership } from "./auth";
import type { WorkspaceRole } from "../src/data/types";
import {
  getDatabase,
  getDocument,
  loadYjsSnapshot,
  saveYjsSnapshot,
  updateDocument,
} from "./store";

type PresenceUser = Pick<AuthUser, "id" | "name" | "color">;

interface CollaborationClient {
  id: string;
  documentId: string;
  socket: WebSocket;
  user: PresenceUser;
  role: WorkspaceRole;
}

const documents = new Map<string, Y.Doc>();
const clients = new Map<WebSocket, CollaborationClient>();
const persistTimers = new Map<string, NodeJS.Timeout>();

function encodeUpdate(update: Uint8Array) {
  return Buffer.from(update).toString("base64");
}

async function getYDoc(documentId: string) {
  const existing = documents.get(documentId);

  if (existing) {
    return existing;
  }

  const doc = new Y.Doc();
  const snapshot = await loadYjsSnapshot(documentId);

  if (snapshot) {
    Y.applyUpdate(doc, snapshot, "server-load");
  }

  documents.set(documentId, doc);
  return doc;
}

function schedulePersist(documentId: string, doc: Y.Doc) {
  const existing = persistTimers.get(documentId);

  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(async () => {
    persistTimers.delete(documentId);
    await saveYjsSnapshot(documentId, Y.encodeStateAsUpdate(doc));
  }, 250);

  persistTimers.set(documentId, timer);
}

function getPresence(documentId: string) {
  return [...clients.values()]
    .filter((client) => client.documentId === documentId)
    .map((client) => client.user);
}

function broadcastPresence(documentId: string) {
  const message = JSON.stringify({
    type: "presence",
    users: getPresence(documentId),
  });

  for (const client of clients.values()) {
    if (client.documentId === documentId && client.socket.readyState === client.socket.OPEN) {
      client.socket.send(message);
    }
  }
}

function broadcastUpdate(documentId: string, sender: WebSocket, update: Uint8Array) {
  for (const client of clients.values()) {
    if (
      client.documentId === documentId &&
      client.socket !== sender &&
      client.socket.readyState === client.socket.OPEN
    ) {
      client.socket.send(update, { binary: true });
    }
  }
}

function toUint8Array(data: WebSocket.RawData) {
  if (Buffer.isBuffer(data)) {
    return new Uint8Array(data);
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  return new Uint8Array(Buffer.concat(data));
}

function canWrite(role: WorkspaceRole) {
  return role === "owner" || role === "admin" || role === "editor";
}

async function handleJsonMessage(client: CollaborationClient, raw: string) {
  const message = JSON.parse(raw) as
    | { type: "presence"; user: PresenceUser }
    | { type: "snapshot"; text: string };

  if (message.type === "presence") {
    broadcastPresence(client.documentId);
  }

  if (message.type === "snapshot") {
    if (!canWrite(client.role)) {
      client.socket.send(
        JSON.stringify({
          type: "error",
          message: "Editor access required",
        }),
      );
      return;
    }

    const text = message.text.trim();
    await updateDocument({
      id: client.documentId,
      content: text,
      summary: text.slice(0, 120) || "New workspace document.",
    });
  }
}

export function attachCollaborationServer(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "", `http://${request.headers.host}`);

    if (!url.pathname.startsWith("/collaboration/")) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (websocket) => {
      wss.emit("connection", websocket, request);
    });
  });

  wss.on("connection", async (socket, request) => {
    const url = new URL(request.url ?? "", `http://${request.headers.host}`);
    const documentId = decodeURIComponent(url.pathname.replace("/collaboration/", ""));
    const user = getUserBySessionToken(getDatabase(), url.searchParams.get("token"));

    if (!user) {
      socket.close(1008, "Authentication required");
      return;
    }

    const membership = getWorkspaceMembership(getDatabase(), user.id);

    if (!membership) {
      socket.close(1008, "Workspace access denied");
      return;
    }

    const document = await getDocument(documentId);

    if (!document) {
      socket.close(1008, "Document not found");
      return;
    }

    const client: CollaborationClient = {
      id: randomUUID(),
      documentId,
      socket,
      user,
      role: membership.role,
    };
    clients.set(socket, client);
    broadcastPresence(documentId);

    const doc = await getYDoc(documentId);
    socket.send(
      JSON.stringify({
        type: "sync",
        update: encodeUpdate(Y.encodeStateAsUpdate(doc)),
        initialText: document.content,
      }),
    );

    socket.on("message", async (data, isBinary) => {
      try {
        if (!isBinary) {
          await handleJsonMessage(client, data.toString());
          return;
        }

        const update = toUint8Array(data);

        if (!canWrite(client.role)) {
          socket.send(
            JSON.stringify({
              type: "error",
              message: "Editor access required",
            }),
          );
          return;
        }

        Y.applyUpdate(doc, update, socket);
        schedulePersist(documentId, doc);
        broadcastUpdate(documentId, socket, update);
      } catch (error) {
        socket.send(
          JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "Collaboration error",
          }),
        );
      }
    });

    socket.on("close", () => {
      clients.delete(socket);
      broadcastPresence(documentId);
    });
  });
}
