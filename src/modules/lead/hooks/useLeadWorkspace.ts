import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listLeadLabels,
  createLeadLabel,
  updateLeadLabel,
  deleteLeadLabel,
  setLeadLabels,
  listReminders,
  createReminder,
  setReminderStatus,
  deleteReminder,
  getLeadWorkspace,
  logCall,
  type CallOutcome,
} from "../api/leadWorkspaceApi";
import type { ReminderStatus } from "../types.labels";

/**
 * Anything that changes a lead can change what the workspace, the list and the
 * dashboard show, so mutations invalidate all three rather than trying to be
 * clever about which.
 */
function useLeadInvalidator() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["reminders"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

// ── Labels ────────────────────────────────────────────────────────────────

export function useLeadLabels(enabled = true) {
  return useQuery({
    queryKey: ["lead-labels"],
    queryFn: listLeadLabels,
    enabled,
    staleTime: 60_000,
  });
}

export function useCreateLeadLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createLeadLabel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-labels"] }),
  });
}

export function useUpdateLeadLabel() {
  const qc = useQueryClient();
  const invalidate = useLeadInvalidator();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; color?: string } }) =>
      updateLeadLabel(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-labels"] });
      invalidate();
    },
  });
}

export function useDeleteLeadLabel() {
  const qc = useQueryClient();
  const invalidate = useLeadInvalidator();
  return useMutation({
    mutationFn: deleteLeadLabel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-labels"] });
      // Deleting a label detaches it from every lead.
      invalidate();
    },
  });
}

export function useSetLeadLabels() {
  const invalidate = useLeadInvalidator();
  return useMutation({
    mutationFn: ({ leadId, labelIds }: { leadId: string; labelIds: string[] }) =>
      setLeadLabels(leadId, labelIds),
    onSuccess: invalidate,
  });
}

// ── Reminders ─────────────────────────────────────────────────────────────

export function useReminders(params: Parameters<typeof listReminders>[0] = {}, enabled = true) {
  return useQuery({
    queryKey: ["reminders", params],
    queryFn: () => listReminders(params),
    enabled,
  });
}

export function useCreateReminder() {
  const invalidate = useLeadInvalidator();
  return useMutation({ mutationFn: createReminder, onSuccess: invalidate });
}

export function useSetReminderStatus() {
  const invalidate = useLeadInvalidator();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReminderStatus }) =>
      setReminderStatus(id, status),
    onSuccess: invalidate,
  });
}

export function useDeleteReminder() {
  const invalidate = useLeadInvalidator();
  return useMutation({ mutationFn: deleteReminder, onSuccess: invalidate });
}

// ── Workspace ─────────────────────────────────────────────────────────────

export function useLeadWorkspace(leadId: string | undefined) {
  return useQuery({
    queryKey: ["leads", "workspace", leadId],
    queryFn: () => getLeadWorkspace(leadId as string),
    enabled: Boolean(leadId),
  });
}

export function useLogCall() {
  const invalidate = useLeadInvalidator();
  return useMutation({
    mutationFn: ({
      leadId,
      outcome,
      note,
    }: {
      leadId: string;
      outcome?: CallOutcome;
      note?: string;
    }) => logCall(leadId, { outcome, note }),
    onSuccess: invalidate,
  });
}
