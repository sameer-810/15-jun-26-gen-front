import { http } from "@/shared/api/http";
import { createResourceApi } from "@/modules/common/createResourceApi";
import type { Lead, LeadListQuery, LeadCreatePayload, AssignableUser } from "../types";

const api = createResourceApi<Lead, LeadListQuery, LeadCreatePayload>("/leads");

export const listLeads = (query: LeadListQuery) => api.list(query);
export const createLead = (payload: LeadCreatePayload) => api.create(payload);
export const updateLead = (id: string, payload: Partial<LeadCreatePayload>) =>
  api.update(id, payload);
export const deleteLead = (id: string) => api.remove(id);

/**
 * Admin-only bulk clear-out. The server only removes dead leads (Not Interested
 * / Irrelevant) and reports how many of the selection it skipped.
 */
export async function bulkDeleteLeads(ids: string[]) {
  const res = await http.post<{ data: { deleted: number; skipped: number }; message: string }>(
    "/leads/bulk-delete",
    { ids },
  );
  return res.data.data;
}

export async function addFollowUp(
  id: string,
  payload: { note: string; nextFollowUpDate?: string },
) {
  const res = await http.post<{ data: Lead }>(`/leads/${id}/follow-ups`, payload);
  return res.data.data;
}

export async function getDueFollowUps() {
  const res = await http.get<{ data: Lead[] }>("/leads/due-follow-ups");
  return res.data.data;
}

export async function getAssignableUsers() {
  const res = await http.get<{ data: AssignableUser[] }>("/auth/users/assignable");
  return res.data.data;
}

export type ConvertLeadPayload = {
  inventoryId: string;
  quantity: number;
  unitPrice: number;
  saleDate?: string;
  customerName?: string;
  customerMobile?: string;
};

export async function convertLead(id: string, payload: ConvertLeadPayload) {
  const res = await http.post<{ data: { lead: Lead; sale: unknown } }>(
    `/leads/${id}/convert`,
    payload,
  );
  return res.data.data;
}

/** Cities present on leads, most common first — feeds the Location filter. */
export async function getLeadCityFacets(): Promise<{ city: string; count: number }[]> {
  const res = await http.get<{ data: { city: string; count: number }[] }>("/leads/facets/cities");
  return res.data.data;
}
