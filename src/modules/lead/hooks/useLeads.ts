import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createResourceHooks } from "@/modules/common/createResourceHooks";
import {
  listLeads,
  createLead,
  updateLead,
  deleteLead,
  bulkDeleteLeads,
  addFollowUp,
  getDueFollowUps,
  getAssignableUsers,
  convertLead,
  type ConvertLeadPayload,
} from "../api/leadApi";
import type { LeadListQuery, LeadCreatePayload, LeadListResult } from "../types";

const crud = createResourceHooks<LeadListQuery, LeadCreatePayload, LeadListResult>("leads", {
  list: listLeads,
  create: createLead,
  update: updateLead,
  remove: deleteLead,
});

export const useLeads = crud.useList;
export const useCreateLead = crud.useCreate;
export const useUpdateLead = crud.useUpdate;
export const useDeleteLead = crud.useDelete;

export function useBulkDeleteLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteLeads(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads", "list"] });
      qc.invalidateQueries({ queryKey: ["leads", "due"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useAddFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      note,
      nextFollowUpDate,
    }: {
      id: string;
      note: string;
      nextFollowUpDate?: string;
    }) => addFollowUp(id, { note, nextFollowUpDate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads", "list"] });
      qc.invalidateQueries({ queryKey: ["leads", "due"] });
    },
  });
}

export function useDueFollowUps() {
  return useQuery({ queryKey: ["leads", "due"], queryFn: getDueFollowUps });
}

export function useConvertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ConvertLeadPayload }) =>
      convertLead(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads", "list"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}

export function useAssignableUsers(enabled = true) {
  return useQuery({
    queryKey: ["assignable-users"],
    queryFn: getAssignableUsers,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
