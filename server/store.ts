import { mkdirSync, readFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  Collaborator,
  DocumentAttachment,
  DocumentComment,
  DocumentStatus,
  DocumentUpdateInput,
  DocumentVersion,
  Workspace,
  WorkspaceActivity,
  WorkspaceActor,
  WorkspaceDocument,
  WorkspaceNotification,
} from "../src/data/types";
import { ensureDemoUser, initializeAuthSchema } from "./auth";
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

interface ActorRow {
  id: string;
  email: string;
  name: string;
  color: string;
}

interface CommentRow {
  id: string;
  document_id: string;
  author_id: string;
  body: string;
  mentions: string;
  created_at: string;
  author_name: string;
  author_email: string;
  author_color: string;
}

interface AttachmentRow {
  id: string;
  document_id: string;
  uploader_id: string;
  name: string;
  type: string;
  size: number;
  data_url: string;
  created_at: string;
  uploader_name: string;
  uploader_email: string;
  uploader_color: string;
}

interface VersionRow {
  id: string;
  document_id: string;
  author_id: string;
  title: string;
  summary: string;
  content: string;
  status: DocumentStatus;
  tags: string;
  created_at: string;
  author_name: string;
  author_email: string;
  author_color: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: WorkspaceNotification["type"];
  message: string;
  document_id: string | null;
  read_at: string | null;
  created_at: string;
}

interface ActivityRow {
  id: string;
  actor_id: string;
  action: string;
  document_id: string | null;
  message: string;
  created_at: string;
  actor_name: string;
  actor_email: string;
  actor_color: string;
}

const dataDir = path.resolve(process.cwd(), process.env.SYNCSPACE_DATA_DIR ?? "data");
const databasePath = path.join(dataDir, "syncspace.sqlite");
const legacyWorkspacePath = path.join(dataDir, "workspace.json");
const legacyYjsDir = path.join(dataDir, "yjs");

let db: DatabaseSync | null = null;

export function getDatabase() {
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
  initializeAuthSchema(db);
  initializeWorkspaceFeatureSchema(db);
  seedIfEmpty();
  ensureDemoUser(db);

  return db;
}

function initializeWorkspaceFeatureSchema(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS document_comments (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      body TEXT NOT NULL,
      mentions TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_attachments (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      uploader_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      size INTEGER NOT NULL,
      data_url TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_versions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL,
      tags TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      document_id TEXT,
      read_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      document_id TEXT,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
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

function actorFromRow(row: {
  id?: string;
  author_id?: string;
  uploader_id?: string;
  actor_id?: string;
  name?: string;
  author_name?: string;
  uploader_name?: string;
  actor_name?: string;
  email?: string;
  author_email?: string;
  uploader_email?: string;
  actor_email?: string;
  color?: string;
  author_color?: string;
  uploader_color?: string;
  actor_color?: string;
}): WorkspaceActor {
  return {
    id: row.id ?? row.author_id ?? row.uploader_id ?? row.actor_id ?? "unknown",
    name: row.name ?? row.author_name ?? row.uploader_name ?? row.actor_name ?? "Unknown",
    email:
      row.email ??
      row.author_email ??
      row.uploader_email ??
      row.actor_email ??
      "unknown@example.com",
    color: row.color ?? row.author_color ?? row.uploader_color ?? row.actor_color ?? "#6b7280",
  };
}

function getActor(userId: string) {
  const row = getDatabase()
    .prepare("SELECT id, email, name, color FROM users WHERE id = ?")
    .get(userId) as ActorRow | undefined;

  return row ? actorFromRow(row) : null;
}

function getMentionedUserIds(body: string) {
  const emails = [...body.matchAll(/@([\w.+-]+@[\w.-]+\.\w+)/g)].map((match) =>
    match[1].toLowerCase(),
  );

  if (emails.length === 0) {
    return [];
  }

  const database = getDatabase();
  const lookup = database.prepare("SELECT id FROM users WHERE email = ?");

  return [...new Set(emails)]
    .map((email) => (lookup.get(email) as { id: string } | undefined)?.id)
    .filter((id): id is string => Boolean(id));
}

function createNotification(input: {
  userId: string;
  type: WorkspaceNotification["type"];
  message: string;
  documentId?: string | null;
  createdAt?: string;
}) {
  getDatabase()
    .prepare(
      `
      INSERT INTO notifications (id, user_id, type, message, document_id, read_at, created_at)
      VALUES (?, ?, ?, ?, ?, NULL, ?)
    `,
    )
    .run(
      randomUUID(),
      input.userId,
      input.type,
      input.message,
      input.documentId ?? null,
      input.createdAt ?? new Date().toISOString(),
    );
}

function createActivity(input: {
  actorId: string;
  action: string;
  documentId?: string | null;
  message: string;
  createdAt?: string;
}) {
  getDatabase()
    .prepare(
      `
      INSERT INTO activity_events (id, actor_id, action, document_id, message, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      randomUUID(),
      input.actorId,
      input.action,
      input.documentId ?? null,
      input.message,
      input.createdAt ?? new Date().toISOString(),
    );
}

function createDocumentVersion(document: WorkspaceDocument, authorId: string) {
  getDatabase()
    .prepare(
      `
      INSERT INTO document_versions (
        id, document_id, author_id, title, summary, content, status, tags, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      randomUUID(),
      document.id,
      authorId,
      document.title,
      document.summary,
      document.content,
      document.status,
      JSON.stringify(document.tags),
      new Date().toISOString(),
    );
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function getWorkspace(currentUserRole: Workspace["currentUserRole"]) {
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
    currentUserRole,
    documents: documents.map(toDocument),
  };
}

export async function getDocument(documentId: string) {
  const row = getDatabase()
    .prepare("SELECT * FROM documents WHERE id = ?")
    .get(documentId) as DocumentRow | undefined;

  return row ? toDocument(row) : null;
}

export async function updateDocument(input: DocumentUpdateInput, actorId = "u1") {
  const current = await getDocument(input.id);

  if (!current) {
    return null;
  }

  const nextDocument: WorkspaceDocument = {
    ...current,
    ...Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ),
    updatedAt: new Date().toISOString(),
  };

  createDocumentVersion(current, actorId);

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

  createActivity({
    actorId,
    action: "document.updated",
    documentId: nextDocument.id,
    message: `updated ${nextDocument.title}`,
  });

  return structuredClone(nextDocument);
}

export async function createDocument(title: string, ownerId = "u1") {
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
    ownerId,
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

  createActivity({
    actorId: ownerId,
    action: "document.created",
    documentId: document.id,
    message: `created ${document.title}`,
  });

  return structuredClone(document);
}

export async function duplicateDocument(documentId: string, ownerId = "u1") {
  const source = await getDocument(documentId);

  if (!source) {
    return null;
  }

  const copy = await createDocument(`${source.title} Copy`, ownerId);
  const updated = await updateDocument(
    {
      id: copy.id,
      content: source.content,
      summary: source.summary,
      status: source.status,
      tags: source.tags,
    },
    ownerId,
  );

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

export async function listDocumentComments(documentId: string) {
  const rows = getDatabase()
    .prepare(
      `
      SELECT document_comments.*,
             users.name as author_name,
             users.email as author_email,
             users.color as author_color
      FROM document_comments
      INNER JOIN users ON users.id = document_comments.author_id
      WHERE document_id = ?
      ORDER BY created_at DESC
    `,
    )
    .all(documentId) as CommentRow[];

  return rows.map(
    (row): DocumentComment => ({
      id: row.id,
      documentId: row.document_id,
      body: row.body,
      mentions: JSON.parse(row.mentions) as string[],
      createdAt: row.created_at,
      author: actorFromRow(row),
    }),
  );
}

export async function createDocumentComment(input: {
  documentId: string;
  authorId: string;
  body: string;
}) {
  const document = await getDocument(input.documentId);

  if (!document) {
    return null;
  }

  const body = input.body.trim();

  if (!body) {
    throw new Error("Comment body is required");
  }

  const mentions = getMentionedUserIds(body);
  const now = new Date().toISOString();
  const id = randomUUID();

  getDatabase()
    .prepare(
      `
      INSERT INTO document_comments (id, document_id, author_id, body, mentions, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    )
    .run(id, input.documentId, input.authorId, body, JSON.stringify(mentions), now);

  createActivity({
    actorId: input.authorId,
    action: "comment.created",
    documentId: input.documentId,
    message: `commented on ${document.title}`,
    createdAt: now,
  });

  const actor = getActor(input.authorId);

  for (const userId of mentions.filter((userId) => userId !== input.authorId)) {
    createNotification({
      userId,
      type: "mention",
      documentId: input.documentId,
      message: `${actor?.name ?? "Someone"} mentioned you in ${document.title}`,
      createdAt: now,
    });
  }

  return (await listDocumentComments(input.documentId)).find((comment) => comment.id === id) ?? null;
}

export async function listDocumentAttachments(documentId: string) {
  const rows = getDatabase()
    .prepare(
      `
      SELECT document_attachments.*,
             users.name as uploader_name,
             users.email as uploader_email,
             users.color as uploader_color
      FROM document_attachments
      INNER JOIN users ON users.id = document_attachments.uploader_id
      WHERE document_id = ?
      ORDER BY created_at DESC
    `,
    )
    .all(documentId) as AttachmentRow[];

  return rows.map(
    (row): DocumentAttachment => ({
      id: row.id,
      documentId: row.document_id,
      name: row.name,
      type: row.type,
      size: row.size,
      dataUrl: row.data_url,
      createdAt: row.created_at,
      uploader: actorFromRow(row),
    }),
  );
}

export async function createDocumentAttachment(input: {
  documentId: string;
  uploaderId: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}) {
  const document = await getDocument(input.documentId);

  if (!document) {
    return null;
  }

  const now = new Date().toISOString();
  const id = randomUUID();

  getDatabase()
    .prepare(
      `
      INSERT INTO document_attachments (
        id, document_id, uploader_id, name, type, size, data_url, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      id,
      input.documentId,
      input.uploaderId,
      input.name.trim() || "Untitled attachment",
      input.type || "application/octet-stream",
      input.size,
      input.dataUrl,
      now,
    );

  createActivity({
    actorId: input.uploaderId,
    action: "attachment.created",
    documentId: input.documentId,
    message: `attached ${input.name} to ${document.title}`,
    createdAt: now,
  });

  return (await listDocumentAttachments(input.documentId)).find((attachment) => attachment.id === id) ?? null;
}

export async function deleteDocumentAttachment(attachmentId: string) {
  const result = getDatabase()
    .prepare("DELETE FROM document_attachments WHERE id = ?")
    .run(attachmentId);

  return result.changes > 0;
}

export async function listDocumentHistory(documentId: string) {
  const rows = getDatabase()
    .prepare(
      `
      SELECT document_versions.*,
             users.name as author_name,
             users.email as author_email,
             users.color as author_color
      FROM document_versions
      INNER JOIN users ON users.id = document_versions.author_id
      WHERE document_id = ?
      ORDER BY created_at DESC
    `,
    )
    .all(documentId) as VersionRow[];

  return rows.map(
    (row): DocumentVersion => ({
      id: row.id,
      documentId: row.document_id,
      title: row.title,
      summary: row.summary,
      content: row.content,
      status: row.status,
      tags: JSON.parse(row.tags) as string[],
      createdAt: row.created_at,
      author: actorFromRow(row),
    }),
  );
}

export async function listNotifications(userId: string) {
  const rows = getDatabase()
    .prepare(
      `
      SELECT *
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `,
    )
    .all(userId) as NotificationRow[];

  return rows.map(
    (row): WorkspaceNotification => ({
      id: row.id,
      type: row.type,
      message: row.message,
      documentId: row.document_id ?? undefined,
      readAt: row.read_at ?? undefined,
      createdAt: row.created_at,
    }),
  );
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const result = getDatabase()
    .prepare(
      `
      UPDATE notifications
      SET read_at = ?
      WHERE id = ? AND user_id = ?
    `,
    )
    .run(new Date().toISOString(), notificationId, userId);

  return result.changes > 0;
}

export async function listWorkspaceActivity() {
  const rows = getDatabase()
    .prepare(
      `
      SELECT activity_events.*,
             users.name as actor_name,
             users.email as actor_email,
             users.color as actor_color
      FROM activity_events
      INNER JOIN users ON users.id = activity_events.actor_id
      ORDER BY created_at DESC
      LIMIT 80
    `,
    )
    .all() as ActivityRow[];

  return rows.map(
    (row): WorkspaceActivity => ({
      id: row.id,
      action: row.action,
      documentId: row.document_id ?? undefined,
      message: row.message,
      createdAt: row.created_at,
      actor: actorFromRow(row),
    }),
  );
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
