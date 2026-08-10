import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createResourceHooks } from "@/modules/common/createResourceHooks";
import {
  listQuotations,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  setQuotationStatus,
  issueQuotation,
  convertQuotation,
  lookupCustomer,
} from "../api/quotationApi";
import type {
  QuotationListQuery,
  QuotationCreatePayload,
  QuotationListResult,
  DocStatus,
  DocType,
} from "../types";

const crud = createResourceHooks<QuotationListQuery, QuotationCreatePayload, QuotationListResult>(
  "quotations",
  {
    list: listQuotations,
    create: createQuotation,
    update: updateQuotation,
    remove: deleteQuotation,
  },
);

export const useQuotations = crud.useList;
export const useCreateQuotation = crud.useCreate;
export const useUpdateQuotation = crud.useUpdate;
export const useDeleteQuotation = crud.useDelete;

export function useSetQuotationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: DocStatus }) =>
      setQuotationStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotations", "list"] }),
  });
}

export function useIssueQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => issueQuotation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotations"] }),
  });
}

export function useConvertQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targetType }: { id: string; targetType: DocType }) =>
      convertQuotation(id, targetType),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotations"] }),
  });
}

/** Imperative — fired by the "Auto-fetch" button, not on every keystroke. */
export function useCustomerLookup() {
  return useMutation({
    mutationFn: (params: { mobile?: string; name?: string }) => lookupCustomer(params),
  });
}
