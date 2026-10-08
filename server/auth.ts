import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

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
  `);
}

export function ensureDemoUser(database: DatabaseSync) {
  const existing = getUserByEmail(database, "demo@syncspace.local");

  if (existing) {
    return toAuthUser(existing);
  }

  return insertUser(database, {
    id: "u1",
    name: "Maya Chen",
    email: "demo@syncspace.local",
    password: "password",
    color: "#1a735c",
  });
}

export async function registerUser(
  database: DatabaseSync,
  input: { name: string; email: string; password: string },
) {
  const user = insertUser(database, input);
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
