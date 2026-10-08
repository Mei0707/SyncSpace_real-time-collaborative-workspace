import { clearAuthToken, getAuthToken } from "../lib/authToken";

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

async function request<T>(path: string, options?: RequestInit) {
  const token = getAuthToken();
  const response = await fetch(`/api/auth${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });

  if (response.status === 401) {
    clearAuthToken();
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(body?.message ?? "Authentication request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function login(input: { email: string; password: string }) {
  return request<AuthSession>("/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function register(input: { name: string; email: string; password: string }) {
  return request<AuthSession>("/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getCurrentUser() {
  return request<{ user: AuthUser }>("/me");
}

export function logout() {
  return request<void>("/logout", { method: "POST" });
}
