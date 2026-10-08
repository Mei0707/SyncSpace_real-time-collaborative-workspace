import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceRole,
} from "../src/data/types";

const sessionDays = 7;
const colors = ["#1a735c", "#2962ff", "#b36b00", "#8b5cf6", "#c2410c", "#0f766e"];

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  color: string;
  password_hash: string;
  password_salt: string;
  created_at: string;
}

interface SessionRow {
  token_hash: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

interface MembershipRow {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
}

interface InvitationRow {
  id: string;
  workspace_id: string;
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
  status: WorkspaceInvitation["status"];
  invited_by: string;
  created_at: string;
  accepted_at: string | null;
}

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64);
  return {
    hash: hash.toString("hex"),
    salt,
  };
}

function verifyPassword(password: string, row: UserRow) {
  const { hash } = hashPassword(password, row.password_salt);
  const expected = Buffer.from(row.password_hash, "hex");
  const actual = Buffer.from(hash, "hex");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function getUserByEmail(database: DatabaseSync, email: string) {
  return database
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalizeEmail(email)) as UserRow | undefined;
}

function getUserById(database: DatabaseSync, userId: string) {
  return database
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(userId) as UserRow | undefined;
}

function insertUser(
  database: DatabaseSync,
  input: { id?: string; name: string; email: string; password: string; color?: string },
) {
  const email = normalizeEmail(input.email);

  if (!email.includes("@")) {
    throw new AuthError("Enter a valid email address.");
  }

  if (input.password.length < 8) {
    throw new AuthError("Password must be at least 8 characters.");
  }

  if (getUserByEmail(database, email)) {
    throw new AuthError("An account with this email already exists.", 409);
  }

  const now = new Date().toISOString();
  const { hash, salt } = hashPassword(input.password);
  const user: AuthUser = {
    id: input.id ?? randomUUID(),
    email,
    name: input.name.trim() || email.split("@")[0],
    color: input.color ?? colors[Math.floor(Math.random() * colors.length)],
    createdAt: now,
  };

  database
    .prepare(
      `
      INSERT INTO users (id, email, name, color, password_hash, password_salt, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(user.id, user.email, user.name, user.color, hash, salt, user.createdAt);

  return user;
}

export function initializeAuthSchema(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workspace_memberships (
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (workspace_id, user_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workspace_invitations (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      invited_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      accepted_at TEXT,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

function getDefaultWorkspaceId(database: DatabaseSync) {
  const row = database
    .prepare("SELECT id FROM workspaces ORDER BY id LIMIT 1")
    .get() as { id: string } | undefined;

  return row?.id ?? null;
}

export function ensureWorkspaceMembership(
  database: DatabaseSync,
  userId: string,
  role: WorkspaceRole,
  workspaceId = getDefaultWorkspaceId(database),
) {
  if (!workspaceId) {
    return null;
  }

  database
    .prepare(
      `
      INSERT OR IGNORE INTO workspace_memberships (
        workspace_id, user_id, role, created_at
      )
      VALUES (?, ?, ?, ?)
    `,
    )
    .run(workspaceId, userId, role, new Date().toISOString());

  return getWorkspaceMembership(database, userId, workspaceId);
}

export function getWorkspaceMembership(
  database: DatabaseSync,
  userId: string,
  workspaceId = getDefaultWorkspaceId(database),
) {
  if (!workspaceId) {
    return null;
  }

  const row = database
    .prepare(
      `
      SELECT workspace_id, user_id, role, created_at
      FROM workspace_memberships
      WHERE workspace_id = ? AND user_id = ?
    `,
    )
    .get(workspaceId, userId) as MembershipRow | undefined;

  return row ?? null;
}

function isAssignableRole(role: WorkspaceRole): role is Exclude<WorkspaceRole, "owner"> {
  return role === "admin" || role === "editor" || role === "viewer";
}

function isWorkspaceRole(role: unknown): role is WorkspaceRole {
  return role === "owner" || role === "admin" || role === "editor" || role === "viewer";
}

function toInvitation(row: InvitationRow): WorkspaceInvitation {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    invitedBy: row.invited_by,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at ?? undefined,
  };
}

export function listWorkspaceMembers(
  database: DatabaseSync,
  workspaceId = getDefaultWorkspaceId(database),
) {
  if (!workspaceId) {
    return [];
  }

  const rows = database
    .prepare(
      `
      SELECT users.id, users.email, users.name, users.color,
             workspace_memberships.role, workspace_memberships.created_at as joined_at
      FROM workspace_memberships
      INNER JOIN users ON users.id = workspace_memberships.user_id
      WHERE workspace_memberships.workspace_id = ?
      ORDER BY
        CASE workspace_memberships.role
          WHEN 'owner' THEN 0
          WHEN 'admin' THEN 1
          WHEN 'editor' THEN 2
          ELSE 3
        END,
        users.name COLLATE NOCASE ASC
    `,
    )
    .all(workspaceId) as Array<{
    id: string;
    email: string;
    name: string;
    color: string;
    role: WorkspaceRole;
    joined_at: string;
  }>;

  return rows.map(
    (row): WorkspaceMember => ({
      id: row.id,
      email: row.email,
      name: row.name,
      color: row.color,
      role: row.role,
      joinedAt: row.joined_at,
    }),
  );
}

export function listWorkspaceInvitations(
  database: DatabaseSync,
  workspaceId = getDefaultWorkspaceId(database),
) {
  if (!workspaceId) {
    return [];
  }

  const rows = database
    .prepare(
      `
      SELECT *
      FROM workspace_invitations
      WHERE workspace_id = ?
      ORDER BY created_at DESC
    `,
    )
    .all(workspaceId) as InvitationRow[];

  return rows.map(toInvitation);
}

function countOwners(database: DatabaseSync, workspaceId = getDefaultWorkspaceId(database)) {
  if (!workspaceId) {
    return 0;
  }

  const row = database
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM workspace_memberships
      WHERE workspace_id = ? AND role = 'owner'
    `,
    )
    .get(workspaceId) as { count: number };

  return row.count;
}

function getMembershipRole(
  database: DatabaseSync,
  userId: string,
  workspaceId = getDefaultWorkspaceId(database),
) {
  return getWorkspaceMembership(database, userId, workspaceId)?.role ?? null;
}

export function createWorkspaceInvitation(
  database: DatabaseSync,
  input: {
    email: string;
    role: WorkspaceRole;
    invitedBy: string;
    workspaceId?: string | null;
  },
) {
  const workspaceId = input.workspaceId ?? getDefaultWorkspaceId(database);
  const email = normalizeEmail(input.email);

  if (!workspaceId) {
    throw new AuthError("Workspace not found.", 404);
  }

  if (!email.includes("@")) {
    throw new AuthError("Enter a valid email address.");
  }

  if (!isAssignableRole(input.role)) {
    throw new AuthError("Invite role must be admin, editor, or viewer.");
  }

  const now = new Date().toISOString();
  const user = getUserByEmail(database, email);
  const invitation: WorkspaceInvitation = {
    id: randomUUID(),
    email,
    role: input.role,
    status: user ? "accepted" : "pending",
    invitedBy: input.invitedBy,
    createdAt: now,
    acceptedAt: user ? now : undefined,
  };

  database
    .prepare(
      `
      INSERT INTO workspace_invitations (
        id, workspace_id, email, role, status, invited_by, created_at, accepted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      invitation.id,
      workspaceId,
      invitation.email,
      invitation.role,
      invitation.status,
      invitation.invitedBy,
      invitation.createdAt,
      invitation.acceptedAt ?? null,
    );

  if (user) {
    ensureWorkspaceMembership(database, user.id, input.role, workspaceId);
  }

  return invitation;
}

export function updateWorkspaceMemberRole(
  database: DatabaseSync,
  input: {
    actorId: string;
    userId: string;
    role: WorkspaceRole;
    workspaceId?: string | null;
  },
) {
  const workspaceId = input.workspaceId ?? getDefaultWorkspaceId(database);

  if (!workspaceId) {
    throw new AuthError("Workspace not found.", 404);
  }

  const actorRole = getMembershipRole(database, input.actorId, workspaceId);
  const currentRole = getMembershipRole(database, input.userId, workspaceId);

  if (!currentRole) {
    throw new AuthError("Member not found.", 404);
  }

  if (!isWorkspaceRole(input.role)) {
    throw new AuthError("Role must be owner, admin, editor, or viewer.");
  }

  if (input.role === "owner" && actorRole !== "owner") {
    throw new AuthError("Only owners can assign owner role.", 403);
  }

  if (currentRole === "owner" && actorRole !== "owner") {
    throw new AuthError("Only owners can change another owner.", 403);
  }

  if (currentRole === "owner" && input.role !== "owner" && countOwners(database, workspaceId) <= 1) {
    throw new AuthError("At least one owner is required.", 409);
  }

  database
    .prepare(
      `
      UPDATE workspace_memberships
      SET role = ?
      WHERE workspace_id = ? AND user_id = ?
    `,
    )
    .run(input.role, workspaceId, input.userId);

  return getWorkspaceMembership(database, input.userId, workspaceId);
}

export function removeWorkspaceMember(
  database: DatabaseSync,
  input: {
    actorId: string;
    userId: string;
    workspaceId?: string | null;
  },
) {
  const workspaceId = input.workspaceId ?? getDefaultWorkspaceId(database);

  if (!workspaceId) {
    throw new AuthError("Workspace not found.", 404);
  }

  const actorRole = getMembershipRole(database, input.actorId, workspaceId);
  const currentRole = getMembershipRole(database, input.userId, workspaceId);

  if (!currentRole) {
    throw new AuthError("Member not found.", 404);
  }

  if (currentRole === "owner" && actorRole !== "owner") {
    throw new AuthError("Only owners can remove owners.", 403);
  }

  if (currentRole === "owner" && countOwners(database, workspaceId) <= 1) {
    throw new AuthError("At least one owner is required.", 409);
  }

  database
    .prepare(
      `
      DELETE FROM workspace_memberships
      WHERE workspace_id = ? AND user_id = ?
    `,
    )
    .run(workspaceId, input.userId);
}

function acceptPendingInvitations(database: DatabaseSync, user: AuthUser) {
  const rows = database
    .prepare(
      `
      SELECT *
      FROM workspace_invitations
      WHERE email = ? AND status = 'pending'
      ORDER BY created_at DESC
    `,
    )
    .all(user.email) as InvitationRow[];

  if (rows.length === 0) {
    ensureWorkspaceMembership(database, user.id, "editor");
    return;
  }

  const acceptedAt = new Date().toISOString();

  for (const row of rows) {
    ensureWorkspaceMembership(database, user.id, row.role, row.workspace_id);
    database
      .prepare(
        `
        UPDATE workspace_invitations
        SET status = 'accepted', accepted_at = ?
        WHERE id = ?
      `,
      )
      .run(acceptedAt, row.id);
  }
}

export function ensureDemoUser(database: DatabaseSync) {
  const existing = getUserByEmail(database, "demo@syncspace.local");

  if (existing) {
    const user = toAuthUser(existing);
    ensureWorkspaceMembership(database, user.id, "owner");
    return user;
  }

  const user = insertUser(database, {
    id: "u1",
    name: "Maya Chen",
    email: "demo@syncspace.local",
    password: "password",
    color: "#1a735c",
  });
  ensureWorkspaceMembership(database, user.id, "owner");
  return user;
}

export async function registerUser(
  database: DatabaseSync,
  input: { name: string; email: string; password: string },
) {
  const user = insertUser(database, input);
  acceptPendingInvitations(database, user);
  return createSession(database, user.id);
}

export async function loginUser(
  database: DatabaseSync,
  input: { email: string; password: string },
) {
  const user = getUserByEmail(database, input.email);

  if (!user || !verifyPassword(input.password, user)) {
    throw new AuthError("Email or password is incorrect.", 401);
  }

  return createSession(database, user.id);
}

export function createSession(database: DatabaseSync, userId: string): AuthSession {
  const user = getUserById(database, userId);

  if (!user) {
    throw new AuthError("User not found.", 404);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionDays * 24 * 60 * 60 * 1000);
  const token = randomBytes(32).toString("base64url");

  database
    .prepare(
      `
      INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `,
    )
    .run(tokenHash(token), userId, expiresAt.toISOString(), now.toISOString());

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    user: toAuthUser(user),
  };
}

export function getUserBySessionToken(database: DatabaseSync, token: string | null) {
  if (!token) {
    return null;
  }

  const session = database
    .prepare("SELECT * FROM sessions WHERE token_hash = ?")
    .get(tokenHash(token)) as SessionRow | undefined;

  if (!session) {
    return null;
  }

  if (Date.parse(session.expires_at) <= Date.now()) {
    database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(session.token_hash);
    return null;
  }

  const user = getUserById(database, session.user_id);
  return user ? toAuthUser(user) : null;
}

export function deleteSession(database: DatabaseSync, token: string | null) {
  if (!token) {
    return;
  }

  database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
}
