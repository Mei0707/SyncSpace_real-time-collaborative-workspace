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
import type { DocumentUpdateInput, Workspace, WorkspaceDocument } from "../data/types";

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
    onMutate: async (input) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: workspaceKeys.root }),
        queryClient.cancelQueries({ queryKey: workspaceKeys.document(input.id) }),
      ]);

      const previousWorkspace = queryClient.getQueryData<Workspace>(
        workspaceKeys.root,
      );
      const previousDocument = queryClient.getQueryData<WorkspaceDocument>(
        workspaceKeys.document(input.id),
      );
      const updatedAt = new Date().toISOString();

      queryClient.setQueryData<Workspace>(workspaceKeys.root, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          documents: current.documents.map((document) =>
            document.id === input.id
              ? { ...document, ...input, updatedAt }
              : document,
          ),
        };
      });

      queryClient.setQueryData<WorkspaceDocument>(
        workspaceKeys.document(input.id),
        (current) => (current ? { ...current, ...input, updatedAt } : current),
      );

      return { previousWorkspace, previousDocument };
    },
    onError: (_error, input, context) => {
      if (context?.previousWorkspace) {
        queryClient.setQueryData(workspaceKeys.root, context.previousWorkspace);
      }

      if (context?.previousDocument) {
        queryClient.setQueryData(
          workspaceKeys.document(input.id),
          context.previousDocument,
        );
      }
    },
    onSuccess: (document) => {
      queryClient.setQueryData(workspaceKeys.document(document.id), document);
      queryClient.setQueryData<Workspace>(workspaceKeys.root, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          documents: current.documents.map((item) =>
            item.id === document.id ? document : item,
          ),
        };
      });
    },
    onSettled: (_document, _error, input) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.root });
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.document(input.id),
      });
    },
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDocument,
    onSuccess: (document) => {
      queryClient.setQueryData(workspaceKeys.document(document.id), document);
      queryClient.setQueryData<Workspace>(workspaceKeys.root, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          documents: [document, ...current.documents],
        };
      });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.root });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDocument,
    onMutate: async (documentId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: workspaceKeys.root }),
        queryClient.cancelQueries({ queryKey: workspaceKeys.document(documentId) }),
      ]);

      const previousWorkspace = queryClient.getQueryData<Workspace>(
        workspaceKeys.root,
      );
      const previousDocument = queryClient.getQueryData<WorkspaceDocument>(
        workspaceKeys.document(documentId),
      );

      queryClient.setQueryData<Workspace>(workspaceKeys.root, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          documents: current.documents.filter(
            (document) => document.id !== documentId,
          ),
        };
      });

      queryClient.removeQueries({ queryKey: workspaceKeys.document(documentId) });

      return { previousWorkspace, previousDocument };
    },
    onError: (_error, documentId, context) => {
      if (context?.previousWorkspace) {
        queryClient.setQueryData(workspaceKeys.root, context.previousWorkspace);
      }

      if (context?.previousDocument) {
        queryClient.setQueryData(
          workspaceKeys.document(documentId),
          context.previousDocument,
        );
      }
    },
    onSuccess: (_result, documentId) => {
      queryClient.removeQueries({ queryKey: workspaceKeys.document(documentId) });
    },
    onSettled: () => {
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
      queryClient.setQueryData<Workspace>(workspaceKeys.root, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          documents: [document, ...current.documents],
        };
      });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.root });
    },
  });
}
