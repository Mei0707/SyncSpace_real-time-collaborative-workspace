import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import { mockWorkspace } from "../data/mockWorkspace";

const mockUser = {
  id: "u1",
  email: "demo@syncspace.local",
  name: "Maya Chen",
  color: "#1a735c",
  createdAt: "2026-10-01T00:00:00.000Z",
};

class MockWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  binaryType = "arraybuffer";

  constructor() {
    super();

    window.setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.dispatchEvent(new Event("open"));
      this.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "sync",
            update: "",
            initialText: "",
          }),
        }),
      );
    }, 0);
  }

  send() {}

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(new CloseEvent("close"));
  }
}

Object.assign(MockWebSocket, {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
});

vi.stubGlobal("WebSocket", MockWebSocket);

vi.stubGlobal(
  "fetch",
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const documentMatch = url.match(/\/api\/documents\/([^/?]+)/);

    if (url.endsWith("/api/auth/me")) {
      return Response.json({ user: mockUser });
    }

    if (url.endsWith("/api/auth/login") && init?.method === "POST") {
      return Response.json({
        token: "test-token",
        expiresAt: "2026-10-15T00:00:00.000Z",
        user: mockUser,
      });
    }

    if (url.endsWith("/api/auth/logout") && init?.method === "POST") {
      return new Response(null, { status: 204 });
    }

    if (url.endsWith("/api/notifications")) {
      return Response.json([]);
    }

    if (url.endsWith("/api/workspace/activity")) {
      return Response.json([]);
    }

    if (url.includes("/comments")) {
      return Response.json(init?.method === "POST" ? {} : [], {
        status: init?.method === "POST" ? 201 : 200,
      });
    }

    if (url.includes("/attachments")) {
      return Response.json(init?.method === "POST" ? {} : [], {
        status: init?.method === "POST" ? 201 : 200,
      });
    }

    if (url.includes("/history")) {
      return Response.json([]);
    }

    if (url.endsWith("/api/workspace")) {
      return Response.json(mockWorkspace);
    }

    if (documentMatch && init?.method === "PATCH") {
      const document = mockWorkspace.documents.find(
        (item) => item.id === documentMatch[1],
      );
      return Response.json(document);
    }

    if (url.includes("/duplicate") && init?.method === "POST") {
      return Response.json(
        { ...mockWorkspace.documents[0], id: "duplicated-doc" },
        { status: 201 },
      );
    }

    if (documentMatch && init?.method === "DELETE") {
      return new Response(null, { status: 204 });
    }

    if (documentMatch) {
      const document = mockWorkspace.documents.find(
        (item) => item.id === documentMatch[1],
      );

      if (!document) {
        return Response.json({ message: "Not found" }, { status: 404 });
      }

      return Response.json(document);
    }

    if (url.endsWith("/api/documents") && init?.method === "POST") {
      return Response.json(mockWorkspace.documents[0], { status: 201 });
    }

    return Response.json({ ok: true });
  }),
);
