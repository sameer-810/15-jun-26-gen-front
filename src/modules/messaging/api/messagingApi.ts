import { http } from "@/shared/api/http";
import type {
  Message,
  MessagingCapabilities,
  SendMessagePayload,
  Template,
  TemplateKind,
  TemplateMeta,
  TemplatePayload,
} from "../types";

// ── Messages ──────────────────────────────────────────────────────────────

export async function getMessagingCapabilities(): Promise<MessagingCapabilities> {
  const res = await http.get<{ data: MessagingCapabilities }>("/messages/capabilities");
  return res.data.data;
}

export async function listLeadMessages(leadId: string): Promise<Message[]> {
  const res = await http.get<{ data: Message[] }>(`/messages/lead/${leadId}`);
  return res.data.data;
}

export async function sendMessage(payload: SendMessagePayload) {
  const res = await http.post<{ data: Message; message: string }>("/messages", payload);
  return res.data.data;
}

/** A shareable public link to a document, without sending anything. */
export async function getDocumentLink(documentId: string) {
  const res = await http.get<{ data: { url: string; expiresInDays: number } }>(
    `/messages/document-link/${documentId}`,
  );
  return res.data.data;
}

// ── Templates ─────────────────────────────────────────────────────────────

export async function listTemplates(params: {
  kind?: TemplateKind;
  search?: string;
  activeOnly?: boolean;
  page?: number;
  limit?: number;
}) {
  const res = await http.get<{ data: Template[]; meta: { total: number } }>("/templates", {
    params,
  });
  return { items: res.data.data, meta: res.data.meta };
}

export async function getTemplateMeta(): Promise<TemplateMeta> {
  const res = await http.get<{ data: TemplateMeta }>("/templates/meta");
  return res.data.data;
}

export async function createTemplate(payload: TemplatePayload) {
  const res = await http.post<{ data: Template }>("/templates", payload);
  return res.data.data;
}

export async function updateTemplate(id: string, payload: Partial<TemplatePayload>) {
  const res = await http.patch<{ data: Template }>(`/templates/${id}`, payload);
  return res.data.data;
}

export async function deleteTemplate(id: string): Promise<void> {
  await http.delete(`/templates/${id}`);
}
