import { useEffect, useState } from "react";
import { MessageCircle, Mail, Paperclip, Info, ExternalLink } from "lucide-react";
import { FormDialog } from "@/modules/common/FormDialog";
import { useMessagingCapabilities, useSendMessage, useTemplates } from "../hooks/useMessaging";
import { useQuotations } from "@/modules/quotation/hooks/useQuotations";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import type { MessageChannel } from "../types";

/**
 * Compose and send a WhatsApp message or email to a customer — change request
 * points 1 and 2.
 *
 * Two send paths, chosen by the server:
 *  - a configured provider sends directly, PDF attached;
 *  - otherwise the CRM prepares the message and returns a hand-off URL, which
 *    this opens so the user can finish sending from their own WhatsApp or mail
 *    client. The PDF travels as a signed public link either way.
 *
 * The dialog says plainly which of the two will happen, so nobody assumes a
 * message left the building when it did not.
 */

const inputCls =
  "w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: MessageChannel;
  /** Lead this concerns — the message is logged against it. */
  leadId?: string;
  /** Pre-filled recipient; falls back to the lead's mobile/email. */
  to?: string;
  /**
   * Document to share, when the caller already knows which one (e.g. sending
   * from a quotation row). Sent as an attachment or a public link.
   * Left unset when sending from a lead — the dialog then offers that lead's
   * own documents to attach, which is point 1's "generate a quotation and send
   * it to the same lead phone number".
   */
  documentId?: string;
  documentLabel?: string;
  onSent?: () => void;
}

export function SendMessageDialog({
  open,
  onOpenChange,
  channel,
  leadId,
  to,
  documentId,
  documentLabel,
  onSent,
}: Props) {
  const { data: caps } = useMessagingCapabilities();
  const { data: templates } = useTemplates({ kind: channel, activeOnly: true, limit: 50 }, open);
  const sendMutation = useSendMessage();

  const [templateId, setTemplateId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pickedDocId, setPickedDocId] = useState("");

  // Only when the caller did not fix a document: this lead's own quotations,
  // proformas and invoices, newest first.
  const offerDocuments = Boolean(leadId) && !documentId;
  const { data: leadDocs } = useQuotations(
    { lead: leadId, page: 1, limit: 20 },
    { enabled: offerDocuments && open },
  );
  const attachedId = documentId || pickedDocId || undefined;
  const attachedLabel =
    documentLabel ||
    leadDocs?.items.find((d) => d.id === pickedDocId)?.docNumberFormatted ||
    undefined;

  const cap = channel === "whatsapp" ? caps?.whatsapp : caps?.email;
  const isWhatsApp = channel === "whatsapp";

  useEffect(() => {
    if (!open) return;
    setRecipient(to ?? "");
    setTemplateId("");
    setSubject("");
    setBody("");
    setPickedDocId("");
  }, [open, to]);

  // Picking a template loads its text so it can be edited before sending.
  useEffect(() => {
    if (!templateId) return;
    const t = templates?.items.find((x) => x.id === templateId);
    if (t) {
      setBody(t.body);
      if (t.subject) setSubject(t.subject);
    }
  }, [templateId, templates]);

  // Offer the default template the first time the list arrives.
  useEffect(() => {
    if (!open || templateId || !templates?.items.length) return;
    const preferred = templates.items.find((t) => t.isDefault) ?? templates.items[0];
    setTemplateId(preferred.id);
  }, [open, templates, templateId]);

  async function send() {
    if (!body.trim() && !templateId) {
      toast.error("Pick a template or write a message");
      return;
    }
    try {
      const message = await sendMutation.mutateAsync({
        leadId,
        channel,
        to: recipient.trim() || undefined,
        // Sending the edited body rather than the template id, so any tweak
        // the user made in the box is what actually goes out.
        body: body.trim() || undefined,
        subject: channel === "email" ? subject.trim() || undefined : undefined,
        documentId: attachedId,
      });

      if (message.handoffUrl) {
        // Hand off to the user's own WhatsApp / mail client.
        window.open(message.handoffUrl, "_blank", "noopener,noreferrer");
        toast.success("Message prepared — finish sending in the window that opened");
      } else {
        toast.success(isWhatsApp ? "WhatsApp message sent" : "Email sent");
      }
      onOpenChange(false);
      onSent?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isWhatsApp ? "Send WhatsApp message" : "Send email"}
      size="lg"
      onSubmit={send}
      isPending={sendMutation.isPending}
      submitLabel={cap?.configured ? "Send" : "Prepare & Open"}
    >
      <div className="space-y-4" data-testid="send-message">
        {/* Be explicit about which of the two paths will happen. */}
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${
            cap?.configured
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-300"
          }`}
          data-testid="send-mode-note"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {cap?.configured ? (
              <>
                Sent directly from the CRM
                {attachedId ? " with the PDF attached" : ""}.
              </>
            ) : (
              <>
                {isWhatsApp ? "WhatsApp" : "Email"} is not connected yet, so the CRM will prepare
                this message and open {isWhatsApp ? "WhatsApp" : "your mail client"} for you to
                press send.
                {attachedId ? (
                  <> The PDF travels as a secure link the customer can tap to open it.</>
                ) : null}
              </>
            )}
          </span>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="send-to">
            {isWhatsApp ? "Mobile" : "Email address"}
          </label>
          <input
            id="send-to"
            className={inputCls}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={isWhatsApp ? "9876543210" : "buyer@company.com"}
          />
        </div>

        <div>
          <label
            className="mb-1 block text-xs font-medium text-muted-foreground"
            htmlFor="send-template"
          >
            Template
          </label>
          <select
            id="send-template"
            className={inputCls}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">— No template —</option>
            {templates?.items.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.isDefault ? " (default)" : ""}
              </option>
            ))}
          </select>
          {!templates?.items.length && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              No {isWhatsApp ? "WhatsApp" : "email"} templates yet — create one under Templates.
            </p>
          )}
        </div>

        {!isWhatsApp && (
          <div>
            <label
              className="mb-1 block text-xs font-medium text-muted-foreground"
              htmlFor="send-subject"
            >
              Subject
            </label>
            <input
              id="send-subject"
              className={inputCls}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
        )}

        <div>
          <label
            className="mb-1 block text-xs font-medium text-muted-foreground"
            htmlFor="send-body"
          >
            Message
          </label>
          <textarea
            id="send-body"
            rows={8}
            className={`${inputCls} leading-relaxed`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your message, or pick a template above."
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {"{{placeholders}}"} such as {"{{customerName}}"} and {"{{docNumber}}"} are filled in
            when the message is sent.
          </p>
        </div>

        {offerDocuments && (
          <div>
            <label
              className="mb-1 block text-xs font-medium text-muted-foreground"
              htmlFor="send-document"
            >
              Attach a document
            </label>
            <select
              id="send-document"
              data-testid="send-document-picker"
              className={inputCls}
              value={pickedDocId}
              onChange={(e) => setPickedDocId(e.target.value)}
            >
              <option value="">— No document —</option>
              {leadDocs?.items.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.docNumberFormatted} · {d.customerName}
                </option>
              ))}
            </select>
            {!leadDocs?.items.length && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                No quotation raised for this lead yet — use Quote on the lead first.
              </p>
            )}
          </div>
        )}

        {attachedId && (
          <div className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm">
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">
              {attachedLabel || "Document"}
              <span className="ml-2 text-xs text-muted-foreground">
                {cap?.canAttach
                  ? "attached as a PDF"
                  : `sent as a secure link, valid ${caps?.documentLinkTtlDays ?? 30} days`}
              </span>
            </span>
            {isWhatsApp ? (
              <MessageCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Mail className="h-4 w-4 text-primary" />
            )}
          </div>
        )}

        {!cap?.configured && (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <ExternalLink className="h-3 w-3" />
            Connect {isWhatsApp ? "the WhatsApp Business API" : "an SMTP account"} in the backend
            environment to send without this step.
          </p>
        )}
      </div>
    </FormDialog>
  );
}
