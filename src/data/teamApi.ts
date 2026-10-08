import type {
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceRole,
} from "./types";
import { clearAuthToken, getAuthToken } from "../lib/authToken";

export interface TeamResponse {
  currentUserRole: WorkspaceRole;
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
}

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
    throw new Error(body?.message ?? "Team request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getTeam() {
  return request<TeamResponse>("/workspace/members");
}

export function inviteMember(input: {
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
}) {
  return request<WorkspaceInvitation>("/workspace/invitations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateMemberRole(input: {
  userId: string;
  role: WorkspaceRole;
}) {
  return request<void>(`/workspace/members/${input.userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role: input.role }),
  });
}

export function removeMember(userId: string) {
  return request<void>(`/workspace/members/${userId}`, {
    method: "DELETE",
  });
}
