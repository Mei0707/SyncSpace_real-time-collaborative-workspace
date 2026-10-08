import { mkdirSync, readFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  Collaborator,
  DocumentUpdateInput,
  Workspace,
  WorkspaceDocument,
} from "../src/data/types";
import { seedWorkspace } from "./seed";

interface DocumentRow {
  id: string;
  title: string;
  summary: string;
  content: string;
  status: WorkspaceDocument["status"];
  tags: string;
  updated_at: string;
  created_at: string;
  owner_id: string;
  collaborators: string;
  sort_order: number;
}

interface WorkspaceRow {
  id: string;
  name: string;
  description: string;
}

const dataDir = path.resolve(process.cwd(), "data");
const databasePath = path.join(dataDir, "syncspace.sqlite");
const legacyWorkspacePath = path.join(dataDir, "workspace.json");
const legacyYjsDir = path.join(dataDir, "yjs");

let db: DatabaseSync | null = null;

function getDatabase() {
  if (db) {
    return db;
  }

  mkdirSync(dataDir, { recursive: true });
  db = new DatabaseSync(databasePath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL,
      tags TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      collaborators TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS yjs_snapshots (
      document_id TEXT PRIMARY KEY,
      snapshot BLOB NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  seedIfEmpty();

  return db;
}

function readInitialWorkspace() {
  try {
    return JSON.parse(readFileSync(legacyWorkspacePath, "utf8")) as Workspace;
  } catch {
    return seedWorkspace;
  }
}

function seedIfEmpty() {
  const database = db!;
  const existing = database
    .prepare("SELECT COUNT(*) as count FROM workspaces")
    .get() as { count: number };

  if (existing.count > 0) {
    return;
  }

  const workspace = readInitialWorkspace();
  database
    .prepare("INSERT INTO workspaces (id, name, description) VALUES (?, ?, ?)")
    .run(workspace.id, workspace.name, workspace.description);

  const insertDocument = database.prepare(`
    INSERT INTO documents (
      id, title, summary, content, status, tags, updated_at, created_at,
      owner_id, collaborators, sort_order
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  workspace.documents.forEach((document, index) => {
    insertDocument.run(
      document.id,
      document.title,
      document.summary,
      document.content,
      document.status,
      JSON.stringify(document.tags),
      document.updatedAt,
      document.createdAt,
      document.ownerId,
      JSON.stringify(document.collaborators),
      index,
    );

    try {
      const legacySnapshot = readFileSync(
        path.join(legacyYjsDir, `${document.id}.bin`),
      );
      database
        .prepare(
          "INSERT OR REPLACE INTO yjs_snapshots (document_id, snapshot, updated_at) VALUES (?, ?, ?)",
        )
        .run(document.id, legacySnapshot, new Date().toISOString());
    } catch {
      // Older workspaces may not have collaborative snapshots yet.
    }
  });
}

function toDocument(row: DocumentRow): WorkspaceDocument {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    content: row.content,
    status: row.status,
    tags: JSON.parse(row.tags) as string[],
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    ownerId: row.owner_id,
    collaborators: JSON.parse(row.collaborators) as Collaborator[],
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function getWorkspace() {
  const database = getDatabase();
  const workspace = database
    .prepare("SELECT * FROM workspaces LIMIT 1")
    .get() as WorkspaceRow | undefined;

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const documents = database
    .prepare("SELECT * FROM documents ORDER BY sort_order ASC, updated_at DESC")
    .all() as DocumentRow[];

  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    documents: documents.map(toDocument),
  };
}

export async function getDocument(documentId: string) {
  const row = getDatabase()
    .prepare("SELECT * FROM documents WHERE id = ?")
    .get(documentId) as DocumentRow | undefined;

  return row ? toDocument(row) : null;
}

export async function updateDocument(input: DocumentUpdateInput) {
  const current = await getDocument(input.id);

  if (!current) {
    return null;
  }

  const nextDocument: WorkspaceDocument = {
    ...current,
    ...input,
    updatedAt: new Date().toISOString(),
  };

  getDatabase()
    .prepare(
      `
      UPDATE documents
      SET title = ?, summary = ?, content = ?, status = ?, tags = ?,
          updated_at = ?, owner_id = ?, collaborators = ?
      WHERE id = ?
    `,
    )
    .run(
      nextDocument.title,
      nextDocument.summary,
      nextDocument.content,
      nextDocument.status,
      JSON.stringify(nextDocument.tags),
      nextDocument.updatedAt,
      nextDocument.ownerId,
      JSON.stringify(nextDocument.collaborators),
      nextDocument.id,
    );

  return structuredClone(nextDocument);
}

export async function createDocument(title: string) {
  const database = getDatabase();
  const now = new Date().toISOString();
  const slug = slugify(title);
  const maxOrder = database
    .prepare("SELECT COALESCE(MAX(sort_order), -1) as value FROM documents")
    .get() as { value: number };

  const document: WorkspaceDocument = {
    id: `${slug || "untitled"}-${Date.now()}`,
    title: title.trim() || "Untitled document",
    summary: "New workspace document.",
    content: "",
    status: "draft",
    tags: [],
    updatedAt: now,
    createdAt: now,
    ownerId: "u1",
    collaborators: [],
  };

  database
    .prepare(
      `
      INSERT INTO documents (
        id, title, summary, content, status, tags, updated_at, created_at,
        owner_id, collaborators, sort_order
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      document.id,
      document.title,
      document.summary,
      document.content,
      document.status,
      JSON.stringify(document.tags),
      document.updatedAt,
      document.createdAt,
      document.ownerId,
      JSON.stringify(document.collaborators),
      maxOrder.value + 1,
    );

  return structuredClone(document);
}

export async function duplicateDocument(documentId: string) {
  const source = await getDocument(documentId);

  if (!source) {
    return null;
  }

  const copy = await createDocument(`${source.title} Copy`);
  const updated = await updateDocument({
    id: copy.id,
    content: source.content,
    summary: source.summary,
    status: source.status,
    tags: source.tags,
  });

  const snapshot = await loadYjsSnapshot(source.id);

  if (snapshot) {
    await saveYjsSnapshot(copy.id, snapshot);
  }

  return updated;
}

export async function deleteDocument(documentId: string) {
  const database = getDatabase();
  const result = database
    .prepare("DELETE FROM documents WHERE id = ?")
    .run(documentId);

  database
    .prepare("DELETE FROM yjs_snapshots WHERE document_id = ?")
    .run(documentId);

  try {
    await unlink(path.join(legacyYjsDir, `${documentId}.bin`));
  } catch {
    // Older snapshots may not exist on disk.
  }

  return result.changes > 0;
}

export async function loadYjsSnapshot(documentId: string) {
  const row = getDatabase()
    .prepare("SELECT snapshot FROM yjs_snapshots WHERE document_id = ?")
    .get(documentId) as { snapshot: Uint8Array } | undefined;

  return row?.snapshot ? Buffer.from(row.snapshot) : null;
}

export async function saveYjsSnapshot(documentId: string, update: Uint8Array) {
  getDatabase()
    .prepare(
      "INSERT OR REPLACE INTO yjs_snapshots (document_id, snapshot, updated_at) VALUES (?, ?, ?)",
    )
    .run(documentId, update, new Date().toISOString());
}
