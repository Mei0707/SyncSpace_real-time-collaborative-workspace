import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDocument,
  deleteDocument,
  duplicateDocument,
  getDocument,
  getWorkspace,
  updateDocument,
} from "../data/workspaceApi";
import type { DocumentUpdateInput } from "../data/types";

export const workspaceKeys = {
  root: ["workspace"] as const,
  document: (documentId: string) => ["document", documentId] as const,
};

export function useWorkspace() {
  return useQuery({
    queryKey: workspaceKeys.root,
    queryFn: getWorkspace,
  });
}

export function useDocument(documentId: string | undefined) {
  return useQuery({
    queryKey: workspaceKeys.document(documentId ?? ""),
    queryFn: () => getDocument(documentId!),
    enabled: Boolean(documentId),
  });
}

export function useWorkspaceSearch(query: string) {
  const workspaceQuery = useWorkspace();

  const documents = useMemo(() => {
    const search = query.trim().toLowerCase();
    const items = workspaceQuery.data?.documents ?? [];

    if (!search) {
      return items;
    }

    return items.filter((document) => {
      const haystack = [
        document.title,
        document.summary,
        document.content,
        document.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [query, workspaceQuery.data?.documents]);

  return { ...workspaceQuery, documents };
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DocumentUpdateInput) => updateDocument(input),
    onSuccess: (document) => {
      queryClient.setQueryData(workspaceKeys.document(document.id), document);
      queryClient.invalidateQueries({ queryKey: workspaceKeys.root });
    },
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.root });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: (_result, documentId) => {
      queryClient.removeQueries({ queryKey: workspaceKeys.document(documentId) });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.root });
    },
  });
}

export function useDuplicateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: duplicateDocument,
    onSuccess: (document) => {
      queryClient.setQueryData(workspaceKeys.document(document.id), document);
      queryClient.invalidateQueries({ queryKey: workspaceKeys.root });
    },
  });
}
