import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import { mockWorkspace } from "../data/mockWorkspace";

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
