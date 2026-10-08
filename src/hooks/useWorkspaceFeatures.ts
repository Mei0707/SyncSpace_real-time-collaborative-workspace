import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDocumentAttachment,
  createDocumentComment,
  deleteDocumentAttachment,
  getDocumentAttachments,
  getDocumentComments,
  getDocumentHistory,
  getNotifications,
  getWorkspaceActivity,
  markNotificationRead,
} from "../data/workspaceFeaturesApi";

export const featureKeys = {
  activity: ["workspace", "activity"] as const,
  notifications: ["notifications"] as const,
  comments: (documentId: string) => ["document", documentId, "comments"] as const,
  attachments: (documentId: string) =>
    ["document", documentId, "attachments"] as const,
  history: (documentId: string) => ["document", documentId, "history"] as const,
};

export function useWorkspaceActivity() {
  return useQuery({
    queryKey: featureKeys.activity,
    queryFn: getWorkspaceActivity,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: featureKeys.notifications,
    queryFn: getNotifications,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: featureKeys.notifications });
    },
  });
}

export function useDocumentComments(documentId: string | undefined) {
  return useQuery({
    queryKey: featureKeys.comments(documentId ?? ""),
    queryFn: () => getDocumentComments(documentId!),
    enabled: Boolean(documentId),
  });
}

export function useCreateDocumentComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDocumentComment,
    onSuccess: (comment) => {
      queryClient.invalidateQueries({
        queryKey: featureKeys.comments(comment.documentId),
      });
      queryClient.invalidateQueries({ queryKey: featureKeys.activity });
    },
  });
}

export function useDocumentAttachments(documentId: string | undefined) {
  return useQuery({
    queryKey: featureKeys.attachments(documentId ?? ""),
    queryFn: () => getDocumentAttachments(documentId!),
    enabled: Boolean(documentId),
  });
}

export function useCreateDocumentAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDocumentAttachment,
    onSuccess: (attachment) => {
      queryClient.invalidateQueries({
        queryKey: featureKeys.attachments(attachment.documentId),
      });
      queryClient.invalidateQueries({ queryKey: featureKeys.activity });
    },
  });
}

export function useDeleteDocumentAttachment(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDocumentAttachment,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: featureKeys.attachments(documentId),
      });
    },
  });
}

export function useDocumentHistory(documentId: string | undefined) {
  return useQuery({
    queryKey: featureKeys.history(documentId ?? ""),
    queryFn: () => getDocumentHistory(documentId!),
    enabled: Boolean(documentId),
  });
}
