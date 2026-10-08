import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Collaboration from "@tiptap/extension-collaboration";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import * as Y from "yjs";
import { useAuth } from "./authContext";
import type { AuthUser } from "../data/authApi";
import { base64ToBytes, bytesToBase64, plainTextToHtml } from "../lib/html";
import { createMissingYjsUpdate, isEmptyYjsUpdate } from "../lib/yjsSync";
import { useUiStore } from "../stores/useUiStore";

export type PresenceUser = Pick<AuthUser, "id" | "name" | "color">;

interface SyncMessage {
  type: "sync";
  update: string;
  initialText: string;
  stateVector?: string;
}

interface SyncUpdateMessage {
  type: "sync-update";
  update: string;
  stateVector: string;
  initialText: string;
}

interface PresenceMessage {
  type: "presence";
  users: PresenceUser[];
}

interface ErrorMessage {
  type: "error";
  message: string;
}

type ServerMessage = SyncMessage | SyncUpdateMessage | PresenceMessage | ErrorMessage;

function getCollaborationUrl(documentId: string, token: string) {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const encodedDocumentId = encodeURIComponent(documentId);
  const encodedToken = encodeURIComponent(token);

  return `${protocol}://${window.location.host}/collaboration/${encodedDocumentId}?token=${encodedToken}`;
}

function sendJson(socket: WebSocket, payload: unknown) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

export function useCollaborativeDocument(documentId: string, fallbackText: string) {
  const { token, user } = useAuth();
  const setConnectionStatus = useUiStore((state) => state.setConnectionStatus);
  const ydoc = useMemo(() => new Y.Doc({ guid: documentId }), [documentId]);
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const pendingSnapshotTextRef = useRef<string | null>(null);
  const hasSeededRef = useRef(false);
  const localUser = user!;
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [isSynced, setSynced] = useState(false);
  const [initialText, setInitialText] = useState(fallbackText);

  const sendPendingSnapshot = useCallback((socket = socketRef.current) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    if (pendingSnapshotTextRef.current === null) {
      return;
    }

    sendJson(socket, {
      type: "snapshot",
      text: pendingSnapshotTextRef.current,
    });
    pendingSnapshotTextRef.current = null;
  }, []);

  const sendStateVector = useCallback((socket: WebSocket) => {
    sendJson(socket, {
      type: "sync-state",
      stateVector: bytesToBase64(Y.encodeStateVector(ydoc)),
    });
  }, [ydoc]);

  const sendMissingLocalUpdate = useCallback((socket: WebSocket, serverStateVector: string) => {
    const missingUpdate = createMissingYjsUpdate(
      ydoc,
      base64ToBytes(serverStateVector),
    );

    if (!isEmptyYjsUpdate(missingUpdate) && socket.readyState === WebSocket.OPEN) {
      socket.send(missingUpdate);
    }
  }, [ydoc]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          undoRedo: false,
        }),
        Collaboration.configure({
          document: ydoc,
        }),
      ],
      editorProps: {
        attributes: {
          class:
            "sync-editor min-h-[52vh] rounded-md border border-line bg-panel px-5 py-5 text-[15px] leading-8 text-ink outline-none shadow-sm md:px-7 md:py-6",
          "data-testid": "collaborative-editor",
        },
      },
      immediatelyRender: false,
      onUpdate: ({ editor: activeEditor }) => {
        pendingSnapshotTextRef.current = activeEditor.getText();

        if (saveTimerRef.current) {
          window.clearTimeout(saveTimerRef.current);
        }

        saveTimerRef.current = window.setTimeout(() => {
          sendPendingSnapshot();
        }, 650);
      },
    },
    [ydoc, sendPendingSnapshot],
  );

  useEffect(() => {
    let retryDelay = 350;
    let isDisposed = false;

    function connect() {
      if (isDisposed) {
        return;
      }

      if (!token) {
        setConnectionStatus("offline");
        return;
      }

      const socket = new WebSocket(getCollaborationUrl(documentId, token));
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;
      setConnectionStatus("reconnecting");

      socket.addEventListener("open", () => {
        retryDelay = 350;
        setSynced(false);
        setConnectionStatus("connected");
        sendJson(socket, { type: "presence", user: localUser });
        sendStateVector(socket);
        sendPendingSnapshot(socket);
      });

      socket.addEventListener("message", (event) => {
        if (typeof event.data !== "string") {
          Y.applyUpdate(ydoc, new Uint8Array(event.data), "remote");
          return;
        }

        const message = JSON.parse(event.data) as ServerMessage;

        if (message.type === "sync") {
          if (message.update) {
            Y.applyUpdate(ydoc, base64ToBytes(message.update), "remote");
          }

          if (message.stateVector) {
            sendMissingLocalUpdate(socket, message.stateVector);
          }

          setInitialText(message.initialText);
          setSynced(true);
        }

        if (message.type === "sync-update") {
          if (message.update) {
            Y.applyUpdate(ydoc, base64ToBytes(message.update), "remote");
          }

          sendMissingLocalUpdate(socket, message.stateVector);
          setInitialText(message.initialText);
          setSynced(true);
        }

        if (message.type === "presence") {
          setPresence(message.users);
        }
      });

      socket.addEventListener("close", () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }

        if (isDisposed) {
          setConnectionStatus("offline");
          return;
        }

        setConnectionStatus("reconnecting");
        retryRef.current = window.setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 1.8, 5_000);
      });
    }

    connect();

    return () => {
      isDisposed = true;

      if (retryRef.current) {
        window.clearTimeout(retryRef.current);
      }

      socketRef.current?.close();
      setPresence([]);
      setSynced(false);
      setConnectionStatus("offline");
    };
  }, [
    documentId,
    localUser,
    sendMissingLocalUpdate,
    sendPendingSnapshot,
    sendStateVector,
    setConnectionStatus,
    token,
    ydoc,
  ]);

  useEffect(() => {
    function handleLocalUpdate(update: Uint8Array, origin: unknown) {
      if (origin === "remote") {
        return;
      }

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(update);
      }
    }

    ydoc.on("update", handleLocalUpdate);

    return () => {
      ydoc.off("update", handleLocalUpdate);
      ydoc.destroy();
    };
  }, [ydoc]);

  useEffect(() => {
    if (!editor || !isSynced || hasSeededRef.current || !initialText.trim()) {
      return;
    }

    if (editor.isEmpty) {
      hasSeededRef.current = true;
      editor.commands.setContent(plainTextToHtml(initialText));
    }
  }, [editor, initialText, isSynced]);

  return {
    editor,
    isSynced,
    localUser,
    presence,
  };
}
