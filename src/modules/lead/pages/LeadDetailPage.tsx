import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  MapPin,
  FileText,
  MessageSquare,
  PhoneCall,
  Reply,
  Settings2,
  ReceiptIndianRupee,
  CheckCircle2,
  MessageCircle,
  Calculator,
  Mail as MailIcon,
} from "lucide-react";
import { useLeadWorkspace, useLogCall } from "../hooks/useLeadWorkspace";
import { useChatAppearance } from "@/modules/settings/hooks/useSettings";
import { ManageLeadDialog } from "../components/ManageLeadDialog";
import { ConvertLeadDialog } from "../components/ConvertLeadDialog";
import { QuotationDialog } from "@/modules/quotation/components/QuotationDialog";
import { SendMessageDialog } from "@/modules/messaging/components/SendMessageDialog";
import type { MessageChannel } from "@/modules/messaging/types";
import { ACTIVITY_META } from "@/modules/activity/constants/activity.constants";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  LEAD_SOURCE_LABELS,
  LABEL_COLOR_CLASSES,
  CALL_OUTCOME_LABELS,
  CALL_OUTCOMES,
} from "../constants/lead.constants";
import { PageLoader } from "@/shared/components/PageLoader";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type { QuotationPrefill } from "@/modules/quotation/types";

/**
 * The lead detail screen from Change Request point 13 — "when you click on a
 * lead it should open this way". Header with labels and contact chips, then
 * engagement counters, contact details, products of interest, the documents
 * and sales this lead produced, and its full history (point 14).
 */

const TABS = ["Overview", "History", "Documents"] as const;
type Tab = (typeof TABS)[number];

function StatTile({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
}) {
  return (
    <div className="flex-1 rounded-lg border border-border bg-background p-3 text-center">
      <Icon className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
      <div className="text-xl font-bold text-foreground">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useLeadWorkspace(id);
  const logCall = useLogCall();
  // Conversation appearance (SRS 3.4). Falls back to the defaults while the
  // query is in flight so the timeline never renders unstyled.
  const { data: appearance } = useChatAppearance();
  const chatDensity = appearance?.chatDensity ?? "comfortable";
  const chatAccentOutgoing = appearance?.chatAccentOutgoing ?? true;
  const chatShowTimestamps = appearance?.chatShowTimestamps ?? true;

  const [tab, setTab] = useState<Tab>("Overview");
  const [manageOpen, setManageOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [callOutcome, setCallOutcome] = useState("connected");
  const [sendChannel, setSendChannel] = useState<MessageChannel | null>(null);
  const [callNote, setCallNote] = useState("");

  if (isLoading) return <PageLoader />;
  if (error || !data) {
    return (
      <div className="erp-page">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Lead not found"}
        </div>
        <Link to="/leads" className="text-sm text-primary hover:underline">
          ← Back to leads
        </Link>
      </div>
    );
  }

  const { lead, engagement, timeline, reminders, quotations, sales } = data;

  const quotePrefill: QuotationPrefill = {
    customerName: lead.customerName,
    customerMobile: lead.mobile,
    customerEmail: lead.email,
    customerAddress: lead.address,
    customerState: lead.state,
    description: lead.requirement,
    kva: lead.requiredKva,
    quantity: lead.quantity || 1,
    unitPrice: lead.estimatedValue || 0,
  };

  async function submitCall() {
    if (!id) return;
    try {
      await logCall.mutateAsync({ leadId: id, outcome: callOutcome as never, note: callNote });
      toast.success("Call logged");
      setCallOpen(false);
      setCallNote("");
      void refetch();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="erp-page" data-testid="lead-detail">
      {/* Header */}
      <div className="pg-tile">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              onClick={() => navigate("/leads")}
              className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Back to leads
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {lead.customerName}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {LEAD_SOURCE_LABELS[lead.source]} · received{" "}
              {formatDateTime(lead.externalCreatedAt || lead.createdAt)}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${LEAD_STATUS_COLORS[lead.status]}`}
              >
                {LEAD_STATUS_LABELS[lead.status]}
              </span>
              {lead.labels?.map((l) => (
                <span
                  key={l.id}
                  data-testid={`detail-label-${l.id}`}
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                    LABEL_COLOR_CLASSES[l.color] ?? LABEL_COLOR_CLASSES.slate
                  }`}
                >
                  {l.name}
                </span>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {lead.mobile && (
                <a
                  href={`tel:${lead.mobile}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 hover:bg-accent"
                >
                  <Phone className="h-3.5 w-3.5" /> {lead.mobile}
                </a>
              )}
              {lead.city && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
                  <MapPin className="h-3.5 w-3.5" /> {lead.city}
                  {lead.state ? `, ${lead.state}` : ""}
                </span>
              )}
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 hover:bg-accent"
                >
                  {lead.email}
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setManageOpen(true)}
              data-testid="open-manage-lead"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Settings2 className="h-4 w-4" /> Manage Lead
            </button>
            <button
              onClick={() => setSendChannel("whatsapp")}
              data-testid="detail-whatsapp"
              className="flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-500/20 dark:text-green-400"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </button>
            <button
              onClick={() => setSendChannel("email")}
              data-testid="detail-email"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              <MailIcon className="h-4 w-4" /> Email
            </button>
            <button
              onClick={() => setCallOpen(true)}
              data-testid="open-log-call"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              <PhoneCall className="h-4 w-4" /> Log Call
            </button>
            {/* Size the genset first, then quote it — the calculator carries
                this customer through to the document. */}
            <Link
              to={`/capacity-calculator?leadId=${lead.id}`}
              data-testid="detail-calculate"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Calculator className="h-4 w-4" /> Calculate
            </Link>
            <button
              onClick={() => setQuoteOpen(true)}
              data-testid="detail-quote"
              className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <FileText className="h-4 w-4" /> Quote
            </button>
            {lead.status !== "converted" && (
              <button
                onClick={() => setConvertOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <CheckCircle2 className="h-4 w-4" /> Convert
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-card hover:bg-accent"
            }`}
          >
            {t}
            {t === "Documents" && quotations.length + sales.length > 0 && (
              <span className="ml-1.5 opacity-70">{quotations.length + sales.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="Engagement">
            <div className="flex gap-2" data-testid="engagement-tiles">
              <StatTile icon={FileText} value={engagement.requirements} label="Requirements" />
              <StatTile icon={PhoneCall} value={engagement.calls} label="Calls" />
              <StatTile icon={Reply} value={engagement.replies} label="Replies" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-border p-2">
                <div className="text-xs text-muted-foreground">Follow-ups</div>
                <div className="font-semibold">{engagement.followUps}</div>
              </div>
              <div className="rounded-lg border border-border p-2">
                <div className="text-xs text-muted-foreground">Est. value</div>
                <div className="font-semibold">{formatCurrency(lead.estimatedValue ?? 0)}</div>
              </div>
            </div>
          </Card>

          <Card title="Contact Details">
            <dl className="space-y-2 text-sm">
              {(
                [
                  ["Mobile", lead.mobile],
                  ["Alternate", lead.alternateMobile],
                  ["Email", lead.email],
                  ["Address", lead.address],
                  ["City", lead.city],
                  ["State", lead.state],
                  ["Assigned to", lead.assignedTo?.name],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 truncate text-right font-medium" title={value ?? ""}>
                    {value || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Requirement">
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {lead.requirement || "No requirement recorded."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {lead.requiredKva ? (
                <span className="rounded-full border border-border px-2.5 py-1">
                  {lead.requiredKva} kVA
                </span>
              ) : null}
              <span className="rounded-full border border-border px-2.5 py-1">
                Qty {lead.quantity ?? 1}
              </span>
              {lead.fuelType && (
                <span className="rounded-full border border-border px-2.5 py-1 capitalize">
                  {lead.fuelType}
                </span>
              )}
            </div>

            {reminders.filter((r) => r.status === "pending").length > 0 && (
              <div className="mt-4">
                <div className="mb-1 text-xs font-semibold text-muted-foreground">
                  UPCOMING REMINDERS
                </div>
                <ul className="space-y-1 text-xs">
                  {reminders
                    .filter((r) => r.status === "pending")
                    .map((r) => (
                      <li
                        key={r.id}
                        className={`rounded-lg border px-2 py-1.5 ${
                          r.isDue ? "border-amber-500/40 bg-amber-500/10" : "border-border"
                        }`}
                      >
                        <span className="font-medium">{formatDateTime(r.remindAt)}</span>
                        {r.note && <span className="block text-muted-foreground">{r.note}</span>}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "History" && (
        <Card title={`History (${timeline.length})`}>
          {timeline.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing recorded for this lead yet.
            </p>
          ) : (
            /*
              Conversation appearance (SRS 3.4) is applied here. This timeline
              *is* the chat box in this product — there is no separate thread
              view — so the business-wide density, accent and timestamp settings
              are what they control.
            */
            <ol
              className={`relative border-l border-border pl-6 ${
                chatDensity === "compact" ? "space-y-2" : "space-y-4"
              }`}
              data-testid="lead-history"
            >
              {timeline.map((a) => {
                const meta = ACTIVITY_META[a.type];
                const Icon = meta?.icon ?? MessageSquare;
                // Messages we sent are the ones the accent applies to; received
                // replies and system events stay neutral.
                const isOutgoing = a.type === "message_sent";
                return (
                  <li key={a.id} className="relative">
                    <span
                      className={`absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border bg-card ${
                        isOutgoing && chatAccentOutgoing ? "border-primary/50" : "border-border"
                      }`}
                    >
                      <Icon
                        className={`h-3 w-3 ${
                          isOutgoing && chatAccentOutgoing
                            ? "text-primary"
                            : (meta?.color ?? "text-muted-foreground")
                        }`}
                      />
                    </span>
                    <div className="text-sm font-medium text-foreground">{a.action}</div>
                    {a.remarks && (
                      <div
                        className={`mt-0.5 whitespace-pre-wrap text-xs ${
                          isOutgoing && chatAccentOutgoing
                            ? "rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-1.5 text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {a.remarks}
                      </div>
                    )}
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {meta?.label ?? a.type} · {a.userName || a.user?.name || "System"}
                      {chatShowTimestamps ? ` · ${formatDateTime(a.createdAt)}` : ""}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      )}

      {tab === "Documents" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title={`Quotations & Invoices (${quotations.length})`}>
            {quotations.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No documents raised from this lead yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {quotations.map((q) => (
                  <li
                    key={q.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block font-mono font-semibold text-primary">
                        {q.docNumberFormatted}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(q.date)} · {q.items.length} item(s)
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold">{formatCurrency(q.grandTotal)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Sales (${sales.length})`}>
            {sales.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                This lead has not converted to a sale.
              </p>
            ) : (
              <ul className="space-y-2">
                {sales.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-medium">
                        <ReceiptIndianRupee className="h-3.5 w-3.5 text-green-600" />
                        {s.modelName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(s.saleDate)} · {s.quantity} unit(s)
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold">{formatCurrency(s.totalAmount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <ManageLeadDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        lead={lead}
        reminders={reminders}
        onSuccess={() => void refetch()}
      />

      <ConvertLeadDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        lead={lead}
        onSuccess={() => void refetch()}
      />

      <QuotationDialog
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        mode="create"
        value={null}
        defaultDocType="quotation"
        prefill={quotePrefill}
        onSuccess={() => void refetch()}
      />

      <SendMessageDialog
        open={Boolean(sendChannel)}
        onOpenChange={(open) => !open && setSendChannel(null)}
        channel={sendChannel ?? "whatsapp"}
        leadId={lead.id}
        to={sendChannel === "email" ? lead.email : lead.mobile}
        onSent={() => void refetch()}
      />

      {/* Log call — the outcome prompt is what makes the Calls counter real. */}
      {callOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="pg-overlay w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-foreground">Log a call</h3>
            <label
              className="mt-4 mb-1 block text-xs font-medium text-muted-foreground"
              htmlFor="call-outcome"
            >
              Outcome
            </label>
            <select
              id="call-outcome"
              value={callOutcome}
              onChange={(e) => setCallOutcome(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CALL_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {CALL_OUTCOME_LABELS[o]}
                </option>
              ))}
            </select>
            <label
              className="mt-3 mb-1 block text-xs font-medium text-muted-foreground"
              htmlFor="call-note"
            >
              Note
            </label>
            <textarea
              id="call-note"
              rows={3}
              value={callNote}
              onChange={(e) => setCallNote(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setCallOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={submitCall}
                disabled={logCall.isPending}
                data-testid="submit-call"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                Log Call
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
