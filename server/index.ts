import http from "node:http";
import cors from "cors";
import express from "express";
import type { AuthUser } from "./auth";
import {
  AuthError,
  createWorkspaceInvitation,
  deleteSession,
  getUserBySessionToken,
  getWorkspaceMembership,
  listWorkspaceInvitations,
  listWorkspaceMembers,
  loginUser,
  removeWorkspaceMember,
  registerUser,
  updateWorkspaceMemberRole,
} from "./auth";
import { attachCollaborationServer } from "./collaboration";
import type { WorkspaceRole } from "../src/data/types";
import {
  createDocument,
  createDocumentAttachment,
  createDocumentComment,
  deleteDocument,
  deleteDocumentAttachment,
  duplicateDocument,
  getDocument,
  getDatabase,
  getWorkspace,
  listDocumentAttachments,
  listDocumentComments,
  listDocumentHistory,
  listNotifications,
  listWorkspaceActivity,
  markNotificationRead,
  updateDocument,
} from "./store";

const port = Number(process.env.PORT ?? 8787);
const app = express();

interface AuthenticatedRequest extends express.Request {
  user: AuthUser;
  authToken: string;
}

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function getBearerToken(request: express.Request) {
  const header = request.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

function getRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

function requireAuth(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction,
) {
  const token = getBearerToken(request);
  const user = getUserBySessionToken(getDatabase(), token);

  if (!token || !user) {
    response.status(401).json({ message: "Authentication required" });
    return;
  }

  (request as AuthenticatedRequest).user = user;
  (request as AuthenticatedRequest).authToken = token;
  next();
}

function getMembershipOrReject(request: express.Request, response: express.Response) {
  const membership = getWorkspaceMembership(
    getDatabase(),
    (request as AuthenticatedRequest).user.id,
  );

  if (!membership) {
    response.status(403).json({ message: "Workspace access denied" });
    return null;
  }

  return membership;
}

function canWrite(role: WorkspaceRole) {
  return role === "owner" || role === "admin" || role === "editor";
}

function canDeleteAny(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

function canManageMembers(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

function requireWriter(request: express.Request, response: express.Response) {
  const membership = getMembershipOrReject(request, response);

  if (!membership) {
    return null;
  }

  if (!canWrite(membership.role)) {
    response.status(403).json({ message: "Editor access required" });
    return null;
  }

  return membership;
}

function requireMemberManager(request: express.Request, response: express.Response) {
  const membership = getMembershipOrReject(request, response);

  if (!membership) {
    return null;
  }

  if (!canManageMembers(membership.role)) {
    response.status(403).json({ message: "Admin access required" });
    return null;
  }

  return membership;
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/api/auth/register", async (request, response, next) => {
  try {
    response.status(201).json(
      await registerUser(getDatabase(), {
        name: request.body.name ?? "",
        email: request.body.email ?? "",
        password: request.body.password ?? "",
      }),
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (request, response, next) => {
  try {
    response.json(
      await loginUser(getDatabase(), {
        email: request.body.email ?? "",
        password: request.body.password ?? "",
      }),
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, (request, response) => {
  response.json({ user: (request as AuthenticatedRequest).user });
});

app.post("/api/auth/logout", requireAuth, (request, response) => {
  deleteSession(getDatabase(), (request as AuthenticatedRequest).authToken);
  response.status(204).send();
});

app.get("/api/workspace", requireAuth, async (_request, response, next) => {
  try {
    const membership = getMembershipOrReject(_request, response);

    if (!membership) {
      return;
    }

    response.json(await getWorkspace(membership.role));
  } catch (error) {
    next(error);
  }
});

app.get("/api/workspace/members", requireAuth, (request, response, next) => {
  try {
    const membership = getMembershipOrReject(request, response);

    if (!membership) {
      return;
    }

    response.json({
      currentUserRole: membership.role,
      members: listWorkspaceMembers(getDatabase()),
      invitations: canManageMembers(membership.role)
        ? listWorkspaceInvitations(getDatabase())
        : [],
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/workspace/activity", requireAuth, async (request, response, next) => {
  try {
    if (!getMembershipOrReject(request, response)) {
      return;
    }

    response.json(await listWorkspaceActivity());
  } catch (error) {
    next(error);
  }
});

app.get("/api/notifications", requireAuth, async (request, response, next) => {
  try {
    if (!getMembershipOrReject(request, response)) {
      return;
    }

    response.json(await listNotifications((request as AuthenticatedRequest).user.id));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/notifications/:notificationId/read", requireAuth, async (request, response, next) => {
  try {
    if (!getMembershipOrReject(request, response)) {
      return;
    }

    const wasUpdated = await markNotificationRead(
      getRouteParam(request.params.notificationId),
      (request as AuthenticatedRequest).user.id,
    );

    if (!wasUpdated) {
      response.status(404).json({ message: "Notification not found" });
      return;
    }

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/api/workspace/invitations", requireAuth, (request, response, next) => {
  try {
    if (!requireMemberManager(request, response)) {
      return;
    }

    response.status(201).json(
      createWorkspaceInvitation(getDatabase(), {
        email: request.body.email ?? "",
        role: request.body.role ?? "viewer",
        invitedBy: (request as AuthenticatedRequest).user.id,
      }),
    );
  } catch (error) {
    next(error);
  }
});

app.patch("/api/workspace/members/:userId", requireAuth, (request, response, next) => {
  try {
    if (!requireMemberManager(request, response)) {
      return;
    }

    response.json(
      updateWorkspaceMemberRole(getDatabase(), {
        actorId: (request as AuthenticatedRequest).user.id,
        userId: getRouteParam(request.params.userId),
        role: request.body.role,
      }),
    );
  } catch (error) {
    next(error);
  }
});

app.delete("/api/workspace/members/:userId", requireAuth, (request, response, next) => {
  try {
    if (!requireMemberManager(request, response)) {
      return;
    }

    removeWorkspaceMember(getDatabase(), {
      actorId: (request as AuthenticatedRequest).user.id,
      userId: getRouteParam(request.params.userId),
    });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/documents/:documentId", requireAuth, async (request, response, next) => {
  try {
    if (!getMembershipOrReject(request, response)) {
      return;
    }

    const document = await getDocument(getRouteParam(request.params.documentId));

    if (!document) {
      response.status(404).json({ message: "Document not found" });
      return;
    }

    response.json(document);
  } catch (error) {
    next(error);
  }
});

app.post("/api/documents", requireAuth, async (request, response, next) => {
  try {
    if (!requireWriter(request, response)) {
      return;
    }

    response
      .status(201)
      .json(
        await createDocument(
          request.body.title ?? "Untitled document",
          (request as AuthenticatedRequest).user.id,
        ),
      );
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/documents/:documentId/duplicate",
  requireAuth,
  async (request, response, next) => {
    try {
      if (!requireWriter(request, response)) {
        return;
      }

      const document = await duplicateDocument(
        getRouteParam(request.params.documentId),
        (request as AuthenticatedRequest).user.id,
      );

      if (!document) {
        response.status(404).json({ message: "Document not found" });
        return;
      }

      response.status(201).json(document);
    } catch (error) {
      next(error);
    }
  },
);

app.patch("/api/documents/:documentId", requireAuth, async (request, response, next) => {
  try {
    if (!requireWriter(request, response)) {
      return;
    }

    const document = await updateDocument({
      id: getRouteParam(request.params.documentId),
      title: request.body.title,
      content: request.body.content,
      summary: request.body.summary,
      status: request.body.status,
      tags: request.body.tags,
    }, (request as AuthenticatedRequest).user.id);

    if (!document) {
      response.status(404).json({ message: "Document not found" });
      return;
    }

    response.json(document);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/documents/:documentId", requireAuth, async (request, response, next) => {
  try {
    const membership = getMembershipOrReject(request, response);

    if (!membership) {
      return;
    }

    const documentId = getRouteParam(request.params.documentId);
    const document = await getDocument(documentId);

    if (!document) {
      response.status(404).json({ message: "Document not found" });
      return;
    }

    if (
      !canDeleteAny(membership.role) &&
      document.ownerId !== (request as AuthenticatedRequest).user.id
    ) {
      response.status(403).json({ message: "Delete access denied" });
      return;
    }

    const wasDeleted = await deleteDocument(documentId);

    if (!wasDeleted) {
      response.status(404).json({ message: "Document not found" });
      return;
    }

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/documents/:documentId/comments", requireAuth, async (request, response, next) => {
  try {
    if (!getMembershipOrReject(request, response)) {
      return;
    }

    response.json(await listDocumentComments(getRouteParam(request.params.documentId)));
  } catch (error) {
    next(error);
  }
});

app.post("/api/documents/:documentId/comments", requireAuth, async (request, response, next) => {
  try {
    if (!getMembershipOrReject(request, response)) {
      return;
    }

    const comment = await createDocumentComment({
      documentId: getRouteParam(request.params.documentId),
      authorId: (request as AuthenticatedRequest).user.id,
      body: request.body.body ?? "",
    });

    if (!comment) {
      response.status(404).json({ message: "Document not found" });
      return;
    }

    response.status(201).json(comment);
  } catch (error) {
    next(error);
  }
});

app.get("/api/documents/:documentId/attachments", requireAuth, async (request, response, next) => {
  try {
    if (!getMembershipOrReject(request, response)) {
      return;
    }

    response.json(await listDocumentAttachments(getRouteParam(request.params.documentId)));
  } catch (error) {
    next(error);
  }
});

app.post("/api/documents/:documentId/attachments", requireAuth, async (request, response, next) => {
  try {
    if (!requireWriter(request, response)) {
      return;
    }

    const attachment = await createDocumentAttachment({
      documentId: getRouteParam(request.params.documentId),
      uploaderId: (request as AuthenticatedRequest).user.id,
      name: request.body.name ?? "",
      type: request.body.type ?? "",
      size: Number(request.body.size ?? 0),
      dataUrl: request.body.dataUrl ?? "",
    });

    if (!attachment) {
      response.status(404).json({ message: "Document not found" });
      return;
    }

    response.status(201).json(attachment);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/attachments/:attachmentId", requireAuth, async (request, response, next) => {
  try {
    if (!requireWriter(request, response)) {
      return;
    }

    const wasDeleted = await deleteDocumentAttachment(
      getRouteParam(request.params.attachmentId),
    );

    if (!wasDeleted) {
      response.status(404).json({ message: "Attachment not found" });
      return;
    }

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/documents/:documentId/history", requireAuth, async (request, response, next) => {
  try {
    if (!getMembershipOrReject(request, response)) {
      return;
    }

    response.json(await listDocumentHistory(getRouteParam(request.params.documentId)));
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
  void next;

  response.status(error instanceof AuthError ? error.status : 500).json({
    message: error instanceof Error ? error.message : "Unexpected server error",
  });
});

const server = http.createServer(app);
attachCollaborationServer(server);

server.listen(port, () => {
  console.log(`SyncSpace API listening on http://localhost:${port}`);
});
