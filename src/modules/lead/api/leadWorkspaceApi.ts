import { http } from "@/shared/api/http";
import type { Lead } from "../types";
import type { LeadLabel, LeadWorkspace, Reminder, ReminderStatus } from "../types.labels";

// ── Labels ────────────────────────────────────────────────────────────────

export async function listLeadLabels(): Promise<LeadLabel[]> {
  const res = await http.get<{ data: LeadLabel[] }>("/lead-labels");
  return res.data.data;
}

export async function createLeadLabel(payload: { name: string; color?: string }) {
  const res = await http.post<{ data: LeadLabel }>("/lead-labels", payload);
  return res.data.data;
}

export async function updateLeadLabel(id: string, payload: { name?: string; color?: string }) {
  const res = await http.patch<{ data: LeadLabel }>(`/lead-labels/${id}`, payload);
  return res.data.data;
}

export async function deleteLeadLabel(id: string): Promise<void> {
  await http.delete(`/lead-labels/${id}`);
}

/** Replaces the lead's whole label set. */
export async function setLeadLabels(leadId: string, labelIds: string[]) {
  const res = await http.put<{ data: Lead }>(`/leads/${leadId}/labels`, { labelIds });
  return res.data.data;
}

// ── Reminders ─────────────────────────────────────────────────────────────

export async function listReminders(params: {
  leadId?: string;
  status?: ReminderStatus;
  mine?: "true" | "false";
  page?: number;
  limit?: number;
}) {
  const res = await http.get<{ data: Reminder[]; meta: { total: number } }>("/reminders", {
    params,
  });
  return { items: res.data.data, meta: res.data.meta };
}

export async function createReminder(payload: { lead: string; remindAt: string; note?: string }) {
  const res = await http.post<{ data: Reminder }>("/reminders", payload);
  return res.data.data;
}

export async function setReminderStatus(id: string, status: ReminderStatus) {
  const res = await http.patch<{ data: Reminder }>(`/reminders/${id}/status`, { status });
  return res.data.data;
}

export async function deleteReminder(id: string): Promise<void> {
  await http.delete(`/reminders/${id}`);
}

// ── Lead workspace ────────────────────────────────────────────────────────

export async function getLeadWorkspace(leadId: string): Promise<LeadWorkspace> {
  const res = await http.get<{ data: LeadWorkspace }>(`/leads/${leadId}/workspace`);
  return res.data.data;
}

export type CallOutcome =
  | "connected"
  | "no_answer"
  | "busy"
  | "wrong_number"
  | "callback_requested";

export async function logCall(leadId: string, payload: { outcome?: CallOutcome; note?: string }) {
  const res = await http.post<{ data: Lead }>(`/leads/${leadId}/calls`, payload);
  return res.data.data;
}
