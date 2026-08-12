import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMessagingCapabilities,
  listLeadMessages,
  sendMessage,
  getDocumentLink,
  listTemplates,
  getTemplateMeta,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "../api/messagingApi";
import type { TemplateKind, TemplatePayload } from "../types";

// ── Messages ──────────────────────────────────────────────────────────────

/** Which providers are live. Rarely changes, so cached for the session. */
export function useMessagingCapabilities() {
  return useQuery({
    queryKey: ["messaging", "capabilities"],
    queryFn: getMessagingCapabilities,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLeadMessages(leadId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["messaging", "lead", leadId],
    queryFn: () => listLeadMessages(leadId as string),
    enabled: Boolean(leadId) && enabled,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messaging"] });
      // A send counts as contact, so the lead and its history move too.
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useDocumentLink() {
  return useMutation({ mutationFn: (documentId: string) => getDocumentLink(documentId) });
}

// ── Templates ─────────────────────────────────────────────────────────────

export function useTemplates(params: Parameters<typeof listTemplates>[0] = {}, enabled = true) {
  return useQuery({
    queryKey: ["templates", params],
    queryFn: () => listTemplates(params),
    enabled,
    staleTime: 60_000,
  });
}

export function useTemplateMeta(enabled = true) {
  return useQuery({
    queryKey: ["templates", "meta"],
    queryFn: getTemplateMeta,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<TemplatePayload> }) =>
      updateTemplate(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export const TEMPLATE_KIND_LABELS: Record<TemplateKind, string> = {
  description: "Item Description",
  terms: "Terms & Conditions",
  whatsapp: "WhatsApp Message",
  email: "Email",
};

export const TEMPLATE_KINDS: TemplateKind[] = ["description", "terms", "whatsapp", "email"];
