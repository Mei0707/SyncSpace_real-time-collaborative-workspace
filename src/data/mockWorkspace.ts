import type { Workspace } from "./types";

const collaborators = [
  { id: "u1", name: "Maya Chen", color: "#1a735c", isOnline: true },
  { id: "u2", name: "Owen Lee", color: "#2962ff", isOnline: true },
  { id: "u3", name: "Priya Shah", color: "#b36b00", isOnline: false },
  { id: "u4", name: "Noah Kim", color: "#8b5cf6", isOnline: true },
];

export const mockWorkspace: Workspace = {
  id: "workspace-syncspace",
  name: "SyncSpace Product",
  description: "Design notes, launch planning, and collaborative documents.",
  currentUserRole: "owner",
  documents: [
    {
      id: "doc-roadmap",
      title: "Product Roadmap",
      summary: "Milestones for editor, presence, reliability, and testing.",
      content:
        "Phase 1 establishes the workspace shell, navigation, mock document data, and state boundaries. Phase 2 adds collaborative editing with WebSocket transport, Yjs document state, and presence indicators. Phase 3 expands the workspace with task boards and performance instrumentation.",
      status: "review",
      tags: ["planning", "milestones"],
      updatedAt: "2026-10-08T17:25:00.000Z",
      createdAt: "2026-10-04T09:15:00.000Z",
      ownerId: "u1",
      collaborators: [collaborators[0], collaborators[1], collaborators[3]],
    },
    {
      id: "doc-editor",
      title: "Collaborative Editor Notes",
      summary: "Architecture notes for future TipTap and Yjs integration.",
      content:
        "The rich text editor should own local editing ergonomics while Yjs owns shared document state. Presence is temporary session state and must not be persisted with the document body. Transport reconnects should be visible but quiet.",
      status: "draft",
      tags: ["editor", "yjs"],
      updatedAt: "2026-10-07T22:12:00.000Z",
      createdAt: "2026-10-03T13:40:00.000Z",
      ownerId: "u2",
      collaborators: [collaborators[0], collaborators[1]],
    },
    {
      id: "doc-reliability",
      title: "Offline Recovery Scenarios",
      summary: "Network interruption paths and user-facing recovery states.",
      content:
        "When a client loses transport connectivity, local edits should remain available, status should move from connected to reconnecting, and the client should reconcile after the socket resumes. Destructive operations need confirmation once persistence exists.",
      status: "draft",
      tags: ["reliability", "sync"],
      updatedAt: "2026-10-06T16:48:00.000Z",
      createdAt: "2026-10-01T11:05:00.000Z",
      ownerId: "u3",
      collaborators: [collaborators[0], collaborators[2]],
    },
    {
      id: "doc-research",
      title: "Workspace Research",
      summary: "Interaction patterns inspired by modern productivity tools.",
      content:
        "The interface should feel fast, quiet, and useful under repeated daily use. Navigation must support scanning, recency, search, and clear active document affordances without leaning on heavy decoration.",
      status: "published",
      tags: ["research", "ux"],
      updatedAt: "2026-10-05T19:35:00.000Z",
      createdAt: "2026-09-30T10:20:00.000Z",
      ownerId: "u4",
      collaborators: [collaborators[1], collaborators[3]],
    },
  ],
};
