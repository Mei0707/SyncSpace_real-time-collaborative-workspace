import type {
  DocumentAttachment,
  DocumentComment,
  DocumentVersion,
  WorkspaceActivity,
  WorkspaceNotification,
} from "./types";
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
    throw new Error(body?.message ?? "Workspace feature request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getDocumentComments(documentId: string) {
  return request<DocumentComment[]>(`/documents/${documentId}/comments`);
}

export function createDocumentComment(input: { documentId: string; body: string }) {
  return request<DocumentComment>(`/documents/${input.documentId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: input.body }),
  });
}

export function getDocumentAttachments(documentId: string) {
  return request<DocumentAttachment[]>(`/documents/${documentId}/attachments`);
}

export function createDocumentAttachment(input: {
  documentId: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}) {
  return request<DocumentAttachment>(`/documents/${input.documentId}/attachments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteDocumentAttachment(attachmentId: string) {
  return request<void>(`/attachments/${attachmentId}`, {
    method: "DELETE",
  });
}

export function getDocumentHistory(documentId: string) {
  return request<DocumentVersion[]>(`/documents/${documentId}/history`);
}

export function getNotifications() {
  return request<WorkspaceNotification[]>("/notifications");
}

export function markNotificationRead(notificationId: string) {
  return request<void>(`/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export function getWorkspaceActivity() {
  return request<WorkspaceActivity[]>("/workspace/activity");
}
