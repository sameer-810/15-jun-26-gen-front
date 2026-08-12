export type MessageChannel = "whatsapp" | "email";

/** `handoff` = prepared, but the user must finish sending in their own app. */
export type MessageStatus = "queued" | "handoff" | "sent" | "delivered" | "read" | "failed";

export type Message = {
  id: string;
  leadId: string | null;
  channel: MessageChannel;
  direction: "outbound" | "inbound";
  toAddress?: string;
  subject?: string;
  body: string;
  templateId?: string | null;
  imageUrl?: string;
  documentId?: string | null;
  documentUrl?: string;
  status: MessageStatus;
  provider?: string;
  error?: string;
  /** Opened by the UI when the provider could not send directly. */
  handoffUrl?: string;
  sentAt?: string;
  sentBy: { id: string; name?: string } | null;
  createdAt: string;
};

/** What the server can actually do right now — drives the button labels. */
export type MessagingCapabilities = {
  whatsapp: { provider: string; configured: boolean; canAttach: boolean };
  email: { provider: string; configured: boolean; canAttach: boolean };
  documentLinkTtlDays: number;
};

export type SendMessagePayload = {
  leadId?: string;
  channel: MessageChannel;
  to?: string;
  templateId?: string;
  subject?: string;
  body?: string;
  documentId?: string;
};

// ── Templates ─────────────────────────────────────────────────────────────

export type TemplateKind = "description" | "terms" | "email" | "whatsapp";

export type Template = {
  id: string;
  kind: TemplateKind;
  name: string;
  subject?: string;
  body: string;
  imageId?: string | null;
  imageUrl?: string | null;
  categories: string[];
  isDefault: boolean;
  isActive: boolean;
  /** Terms templates only — the body pre-split into individual conditions. */
  lines?: string[];
  createdAt: string;
  updatedAt: string;
};

export type TemplatePayload = {
  kind: TemplateKind;
  name: string;
  subject?: string;
  body?: string;
  imageId?: string;
  categories?: string;
  isDefault?: boolean;
  isActive?: boolean;
};

export type TemplateMeta = {
  placeholders: { token: string; label: string }[];
  counts: { kind: TemplateKind; count: number }[];
};
