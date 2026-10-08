import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTeam,
  inviteMember,
  removeMember,
  updateMemberRole,
} from "../data/teamApi";
import { workspaceKeys } from "./useWorkspace";

export const teamKeys = {
  root: ["team"] as const,
};

export function useTeam() {
  return useQuery({
    queryKey: teamKeys.root,
    queryFn: getTeam,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: inviteMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.root });
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMemberRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.root });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.root });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.root });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.root });
    },
  });
}
