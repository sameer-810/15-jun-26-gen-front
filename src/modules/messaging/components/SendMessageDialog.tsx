import { useEffect, useState } from "react";
import { MessageCircle, Mail, Paperclip, Info, ExternalLink, Zap } from "lucide-react";
import { FormDialog } from "@/modules/common/FormDialog";
import {
  useMessagingCapabilities,
  useSendMessage,
  useTemplates,
  useMostUsedTemplates,
} from "../hooks/useMessaging";
import { useQuotations } from "@/modules/quotation/hooks/useQuotations";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import type { MessageChannel } from "../types";

/**
 * Compose and send a WhatsApp message or email to a customer — the client's brief
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
   * own documents to attach — "generate a quotation and send
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
  // The one the team actually reaches for, offered as a single tap.
  const { data: mostUsed, isPending: quickPending } = useMostUsedTemplates(
    { kind: channel, limit: 1 },
    open,
  );
  const quick = mostUsed?.[0];
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

  const templateImageUrl = templates?.items.find((t) => t.id === templateId)?.imageUrl || null;
  const cap = channel === "whatsapp" ? caps?.whatsapp : caps?.email;
  const isWhatsApp = channel === "whatsapp";

  /*
    What the customer will actually see of the template's picture. Without the
    Business API a WhatsApp message is a link that carries text only, so the
    picture reaches the chat as a link preview card instead, and WhatsApp
    previews one link per message, so an attached document's card takes its
    place. An upload from before online storage lives on localhost, where
    WhatsApp cannot fetch it.
  */
  const pictureIsOnline = Boolean(templateImageUrl?.startsWith("https://"));
  const pictureNote = cap?.configured
    ? "This picture is sent ahead of the message."
    : !pictureIsOnline
      ? "Customers can't see this picture: it was uploaded before online storage was set up. Re-upload it in Templates."
      : attachedId
        ? "With a document attached, WhatsApp shows the document's card instead of this picture."
        : "Your customer sees this picture as a preview card above the message.";

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

  /*
    Offer a template the first time the list arrives — unless there is a
    most-used one to offer as a quick pick instead.

    Auto-selecting *and* showing the quick button would be pointless: the button
    hides once its template is chosen, so it would never appear. Leaving the
    dropdown empty makes the quick button the one-tap path it is meant to be,
    and the dropdown stays there for anything else.
  */
  useEffect(() => {
    if (!open || templateId || !templates?.items.length) return;
    // Wait for the ranking before deciding. Without this the two queries race:
    // the template list lands first, this picks the default, and the quick
    // button then has nothing left to offer.
    if (quickPending) return;
    if (quick) return;
    const preferred = templates.items.find((t) => t.isDefault) ?? templates.items[0];
    setTemplateId(preferred.id);
  }, [open, templates, templateId, quick, quickPending]);

  async function send() {
    if (!body.trim() && !templateId) {
      toast.error("Pick a template or write a message");
      return;
    }
    /*
      Open the tab NOW, before the network call.

      Safari on iOS only allows a new window from inside the synchronous part of
      a user gesture. Sending is a round-trip to the server, so by the time the
      handoff URL comes back the gesture is over and Safari silently blocks the
      popup — WhatsApp never opens. Android's browser is permissive and allows
      it, which is why this worked there and failed on iPhone.

      So the window is claimed while the tap is still on the stack and pointed at
      the URL once it arrives. `noopener` is deliberately not set here: it makes
      `window.open` return null, and we need the handle to navigate it.
    */
    const willHandOff = !cap?.configured;
    const handoff = willHandOff ? window.open("", "_blank") : null;

    try {
      const message = await sendMutation.mutateAsync({
        leadId,
        channel,
        to: recipient.trim() || undefined,
        // Both: the edited body is what goes out (the server prefers it), and
        // the template id carries its image along — an IndiaMART-style
        // "template with image and full description".
        templateId: templateId || undefined,
        body: body.trim() || undefined,
        subject: channel === "email" ? subject.trim() || undefined : undefined,
        documentId: attachedId,
      });

      if (message.handoffUrl) {
        if (handoff && !handoff.closed) {
          handoff.location.href = message.handoffUrl;
        } else {
          // The popup was blocked even so, or we did not expect a handoff.
          // Navigating this tab still reaches WhatsApp; the browser comes back
          // when the user returns from the app.
          window.location.href = message.handoffUrl;
        }
        toast.success("Message prepared — finish sending in WhatsApp");
      } else {
        handoff?.close();
        toast.success(isWhatsApp ? "WhatsApp message sent" : "Email sent");
      }
      onOpenChange(false);
      onSent?.();
    } catch (err) {
      handoff?.close();
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
          {/*
            Quick pick, above the dropdown rather than inside it. The dropdown
            is a list of equals; this says "the one you almost always want" and
            saves opening it at all. Hidden once it is already selected — a
            button that does nothing is worse than no button.
          */}
          {quick && quick.id !== templateId && (
            <button
              type="button"
              data-testid="quick-template"
              onClick={() => setTemplateId(quick.id)}
              title={`Used ${quick.uses} time${quick.uses === 1 ? "" : "s"}`}
              className="mb-2 flex w-full items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <Zap className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">Quick: {quick.name}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums opacity-70">
                {quick.uses}×
              </span>
            </button>
          )}
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

        {/* WhatsApp only. The email sender has no way to carry the picture, and
            promising it there was worse than saying nothing. */}
        {templateImageUrl && isWhatsApp && (
          <div className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm">
            <img
              src={templateImageUrl}
              alt="Template image"
              data-testid="template-image-preview"
              className="h-12 w-12 shrink-0 rounded border border-border object-cover"
            />
            <span className="text-xs text-muted-foreground" data-testid="template-image-note">
              {pictureNote}
            </span>
          </div>
        )}

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
