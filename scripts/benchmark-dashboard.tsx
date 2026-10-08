import { performance } from "node:perf_hooks";
import { JSDOM } from "jsdom";
import React, { Profiler, type ProfilerOnRenderCallback } from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { App } from "../src/App";
import { AuthProvider } from "../src/hooks/useAuth";
import type {
  Collaborator,
  DocumentStatus,
  Workspace,
  WorkspaceDocument,
} from "../src/data/types";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const counts = [100, 500, 1_000];
const statuses: DocumentStatus[] = ["draft", "review", "published"];
const collaborators: Collaborator[] = [
  { id: "u1", name: "Maya Chen", color: "#1a735c", isOnline: true },
  { id: "u2", name: "Owen Lee", color: "#2962ff", isOnline: true },
  { id: "u3", name: "Noah Kim", color: "#8b5cf6", isOnline: false },
];

interface CommitSample {
  actualDuration: number;
  phase: "mount" | "update" | "nested-update";
}

interface BenchmarkResult {
  documents: number;
  initialRender: ReturnType<typeof summarizeSamples>;
  filterInteraction: {
    latencyMs: number;
    commits: ReturnType<typeof summarizeSamples>;
  };
}

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    pretendToBeVisual: true,
    url: "http://localhost:5173/",
  });

  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.localStorage = dom.window.localStorage;
  Object.defineProperty(globalThis, "performance", {
    configurable: true,
    value: performance,
  });
  Object.defineProperty(dom.window, "performance", {
    configurable: true,
    value: performance,
  });
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
}

function makeWorkspace(documentCount: number): Workspace {
  const documents: WorkspaceDocument[] = Array.from(
    { length: documentCount },
    (_, index) => {
      const number = index + 1;
      const status = statuses[index % statuses.length];

      return {
        id: `doc-${number}`,
        title: `Benchmark Document ${number}`,
        summary:
          "Performance benchmark document used to measure dashboard render and filter behavior.",
        content:
          "Generated document content for frontend performance benchmarking.",
        status,
        tags: [status, index % 2 === 0 ? "planning" : "sync"],
        updatedAt: new Date(Date.UTC(2026, 9, 8, 12, index % 60)).toISOString(),
        createdAt: new Date(Date.UTC(2026, 8, 20, 9, index % 60)).toISOString(),
        ownerId: collaborators[index % collaborators.length].id,
        collaborators: [
          collaborators[index % collaborators.length],
          collaborators[(index + 1) % collaborators.length],
        ],
      };
    },
  );

  return {
    id: "workspace-benchmark",
    name: "SyncSpace Product",
    description: "Dashboard performance benchmark workspace.",
    currentUserRole: "owner",
    documents,
  };
}

function installFetchMock(workspace: Workspace) {
  const user = {
    id: "u1",
    email: "demo@syncspace.local",
    name: "Maya Chen",
    color: "#1a735c",
    createdAt: "2026-10-01T00:00:00.000Z",
  };

  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = input.toString();

    if (url.endsWith("/api/auth/me")) {
      return Response.json({ user });
    }

    if (url.endsWith("/api/workspace")) {
      return Response.json(workspace);
    }

    if (url.endsWith("/api/notifications") || url.endsWith("/api/workspace/activity")) {
      return Response.json([]);
    }

    return Response.json({ message: `Unhandled benchmark request: ${url}` }, {
      status: 404,
    });
  };
}

function installWebSocketMock() {
  class BenchmarkWebSocket extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = BenchmarkWebSocket.OPEN;
    binaryType = "arraybuffer";

    send() {}
    close() {
      this.readyState = BenchmarkWebSocket.CLOSED;
      this.dispatchEvent(new Event("close"));
    }
  }

  globalThis.WebSocket = BenchmarkWebSocket as unknown as typeof WebSocket;
}

function summarizeSamples(samples: CommitSample[]) {
  const durations = samples.map((sample) => sample.actualDuration);
  const totalMs = durations.reduce((sum, duration) => sum + duration, 0);

  return {
    commits: samples.length,
    totalMs: Number(totalMs.toFixed(2)),
    maxMs: Number((Math.max(...durations) || 0).toFixed(2)),
    avgMs: Number((totalMs / Math.max(samples.length, 1)).toFixed(2)),
  };
}

async function runBenchmark(documentCount: number): Promise<BenchmarkResult> {
  document.body.innerHTML = "";
  window.localStorage.setItem("syncspace-auth-token", "benchmark-token");
  installFetchMock(makeWorkspace(documentCount));

  const samples: CommitSample[] = [];
  const onRender: ProfilerOnRenderCallback = (
    _id,
    phase,
    actualDuration,
  ) => {
    samples.push({ phase, actualDuration });
  };

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/"]}>
          <Profiler id="dashboard" onRender={onRender}>
            <App />
          </Profiler>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );

  await view.findByRole("heading", { name: "SyncSpace Product" });
  await waitFor(() => {
    if (
      view.getByText("Visible docs").previousElementSibling?.textContent !==
      String(documentCount)
    ) {
      throw new Error("Dashboard documents have not loaded.");
    }
  });

  const initialSamples = samples.splice(0);
  const expectedPublishedCount = Math.floor(documentCount / statuses.length);
  const publishedFilter = view.getByRole("button", { name: /published/i });
  const start = performance.now();

  await act(async () => {
    fireEvent.click(publishedFilter);
  });

  await waitFor(() => {
    if (
      view.getByText("Visible docs").previousElementSibling?.textContent !==
      String(expectedPublishedCount)
    ) {
      throw new Error("Dashboard status filter has not settled.");
    }
  });

  const latencyMs = performance.now() - start;

  return {
    documents: documentCount,
    initialRender: summarizeSamples(initialSamples),
    filterInteraction: {
      latencyMs: Number(latencyMs.toFixed(2)),
      commits: summarizeSamples(samples.splice(0)),
    },
  };
}

installDom();
installWebSocketMock();

const results = [];

for (const count of counts) {
  results.push(await runBenchmark(count));
}

console.table(
  results.map((result) => ({
    documents: result.documents,
    initialCommits: result.initialRender.commits,
    initialTotalMs: result.initialRender.totalMs,
    initialMaxMs: result.initialRender.maxMs,
    filterLatencyMs: result.filterInteraction.latencyMs,
    filterCommits: result.filterInteraction.commits.commits,
    filterCommitTotalMs: result.filterInteraction.commits.totalMs,
    filterCommitMaxMs: result.filterInteraction.commits.maxMs,
  })),
);
