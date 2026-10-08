import type { APIRequestContext, Browser, BrowserContext } from "@playwright/test";
import { expect } from "@playwright/test";

type WorkspaceRole = "admin" | "editor" | "viewer";

export async function loginViaApi(request: APIRequestContext) {
  const response = await request.post("/api/auth/login", {
    data: {
      email: "demo@syncspace.local",
      password: "password",
    },
  });

  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { token: string };
}

export async function createDocumentViaApi(
  request: APIRequestContext,
  token: string,
  title: string,
) {
  const response = await request.post("/api/documents", {
    headers: { Authorization: `Bearer ${token}` },
    data: { title },
  });

  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { id: string; title: string };
}

export async function createUserWithRole(
  request: APIRequestContext,
  token: string,
  role: WorkspaceRole,
) {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `${role}-${stamp}@syncspace.local`;
  const password = "password";

  const invitation = await request.post("/api/workspace/invitations", {
    headers: { Authorization: `Bearer ${token}` },
    data: { email, role },
  });
  expect(invitation.ok()).toBeTruthy();

  const registration = await request.post("/api/auth/register", {
    data: {
      email,
      name: `${role} user`,
      password,
    },
  });
  expect(registration.ok()).toBeTruthy();

  return (await registration.json()) as { token: string };
}

export async function authenticatedContext(
  browser: Browser,
  token: string,
): Promise<BrowserContext> {
  const context = await browser.newContext();
  await context.addInitScript((authToken) => {
    window.localStorage.setItem("syncspace-auth-token", authToken);
  }, token);

  return context;
}
