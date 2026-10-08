export type DocumentStatus = "draft" | "review" | "published";
export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  isOnline: boolean;
}

export interface WorkspaceDocument {
  id: string;
  title: string;
  summary: string;
  content: string;
  status: DocumentStatus;
  tags: string[];
  updatedAt: string;
  createdAt: string;
  ownerId: string;
  collaborators: Collaborator[];
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  currentUserRole: WorkspaceRole;
  documents: WorkspaceDocument[];
}

export interface WorkspaceMember {
  id: string;
  email: string;
  name: string;
  color: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WorkspaceInvitation {
  id: string;
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
  status: "pending" | "accepted";
  invitedBy: string;
  createdAt: string;
  acceptedAt?: string;
}

export interface DocumentUpdateInput {
  id: string;
  title?: string;
  content?: string;
  summary?: string;
  status?: DocumentStatus;
  tags?: string[];
}

export interface WorkspaceActor {
  id: string;
  name: string;
  email: string;
  color: string;
}

export interface DocumentComment {
  id: string;
  documentId: string;
  body: string;
  mentions: string[];
  createdAt: string;
  author: WorkspaceActor;
}

export interface DocumentAttachment {
  id: string;
  documentId: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  createdAt: string;
  uploader: WorkspaceActor;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  title: string;
  summary: string;
  content: string;
  status: DocumentStatus;
  tags: string[];
  createdAt: string;
  author: WorkspaceActor;
}

export interface WorkspaceNotification {
  id: string;
  type: "mention" | "document" | "team";
  message: string;
  documentId?: string;
  createdAt: string;
  readAt?: string;
}

export interface WorkspaceActivity {
  id: string;
  action: string;
  message: string;
  documentId?: string;
  createdAt: string;
  actor: WorkspaceActor;
}
