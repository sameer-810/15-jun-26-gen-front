import { http } from "@/shared/api/http";
import { createResourceApi } from "@/modules/common/createResourceApi";
import type {
  Quotation,
  QuotationListQuery,
  QuotationCreatePayload,
  DocStatus,
  DocType,
  CustomerLookup,
} from "../types";

const api = createResourceApi<Quotation, QuotationListQuery, QuotationCreatePayload>("/quotations");

export const listQuotations = (query: QuotationListQuery) => api.list(query);
export const createQuotation = (payload: QuotationCreatePayload) => api.create(payload);
export const updateQuotation = (id: string, payload: Partial<QuotationCreatePayload>) =>
  api.update(id, payload);
export const deleteQuotation = (id: string) => api.remove(id);

export async function setQuotationStatus(id: string, status: DocStatus) {
  const res = await http.patch<{ data: Quotation }>(`/quotations/${id}/status`, { status });
  return res.data.data;
}

/** Finalise a tax invoice — after this it is read-only. */
export async function issueQuotation(id: string) {
  const res = await http.post<{ data: Quotation }>(`/quotations/${id}/issue`);
  return res.data.data;
}

/** Raise a new document of `targetType` from this one (PI → Tax Invoice). */
export async function convertQuotation(id: string, targetType: DocType) {
  const res = await http.post<{ data: Quotation }>(`/quotations/${id}/convert`, { targetType });
  return res.data.data;
}

/** "Auto fetch" (point 6) — the last billing/shipping block for a customer. */
export async function lookupCustomer(params: { mobile?: string; name?: string }) {
  const res = await http.get<{ data: CustomerLookup | null }>("/quotations/customer-lookup", {
    params,
  });
  return res.data.data;
}

export const quotationPdfPath = (id: string) => `/quotations/${id}/pdf`;
