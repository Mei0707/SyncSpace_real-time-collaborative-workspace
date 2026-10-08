import http from "node:http";
import cors from "cors";
import express from "express";
import { attachCollaborationServer } from "./collaboration";
import {
  createDocument,
  deleteDocument,
  duplicateDocument,
  getDocument,
  getWorkspace,
  updateDocument,
} from "./store";

const port = Number(process.env.PORT ?? 8787);
const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/workspace", async (_request, response, next) => {
  try {
    response.json(await getWorkspace());
  } catch (error) {
    next(error);
  }
});

app.get("/api/documents/:documentId", async (request, response, next) => {
  try {
    const document = await getDocument(request.params.documentId);

    if (!document) {
      response.status(404).json({ message: "Document not found" });
      return;
    }

    response.json(document);
  } catch (error) {
    next(error);
  }
});

app.post("/api/documents", async (request, response, next) => {
  try {
    response.status(201).json(await createDocument(request.body.title ?? "Untitled document"));
  } catch (error) {
    next(error);
  }
});

app.post("/api/documents/:documentId/duplicate", async (request, response, next) => {
  try {
    const document = await duplicateDocument(request.params.documentId);

    if (!document) {
      response.status(404).json({ message: "Document not found" });
      return;
    }

    response.status(201).json(document);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/documents/:documentId", async (request, response, next) => {
  try {
    const document = await updateDocument({
      id: request.params.documentId,
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

app.delete("/api/documents/:documentId", async (request, response, next) => {
  try {
    const wasDeleted = await deleteDocument(request.params.documentId);

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

  response.status(500).json({
    message: error instanceof Error ? error.message : "Unexpected server error",
  });
});

const server = http.createServer(app);
attachCollaborationServer(server);

server.listen(port, () => {
  console.log(`SyncSpace API listening on http://localhost:${port}`);
});
