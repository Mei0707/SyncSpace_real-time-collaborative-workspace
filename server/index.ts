import http from "node:http";
import cors from "cors";
import express from "express";
import type { AuthUser } from "./auth";
import { AuthError, deleteSession, getUserBySessionToken, loginUser, registerUser } from "./auth";
import { attachCollaborationServer } from "./collaboration";
import {
  createDocument,
  deleteDocument,
  duplicateDocument,
  getDocument,
  getDatabase,
  getWorkspace,
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
    response.json(await getWorkspace());
  } catch (error) {
    next(error);
  }
});

app.get("/api/documents/:documentId", requireAuth, async (request, response, next) => {
  try {
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
    const document = await updateDocument({
      id: getRouteParam(request.params.documentId),
      ...request.body,
    });

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
    const wasDeleted = await deleteDocument(getRouteParam(request.params.documentId));

    if (!wasDeleted) {
      response.status(404).json({ message: "Document not found" });
      return;
    }

    response.status(204).send();
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
