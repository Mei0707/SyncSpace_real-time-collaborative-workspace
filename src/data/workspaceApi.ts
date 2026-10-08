import type { DocumentUpdateInput, Workspace, WorkspaceDocument } from "./types";
import { clearAuthToken, getAuthToken } from "../lib/authToken";

async function request<T>(path: string, options?: RequestInit) {
  const token = getAuthToken();
  const response = await fetch(`/api${path}`, {
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
    throw new Error(body?.message ?? "Workspace request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getWorkspace() {
  return request<Workspace>("/workspace");
}

export async function getDocument(documentId: string) {
  return request<WorkspaceDocument>(`/documents/${documentId}`);
}

export async function updateDocument(input: DocumentUpdateInput) {
  const { id, ...body } = input;

  return request<WorkspaceDocument>(`/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function createDocument(title: string) {
  return request<WorkspaceDocument>("/documents", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function deleteDocument(documentId: string) {
  await request<void>(`/documents/${documentId}`, {
    method: "DELETE",
  });
}

export async function duplicateDocument(documentId: string) {
  return request<WorkspaceDocument>(`/documents/${documentId}/duplicate`, {
    method: "POST",
  });
}
