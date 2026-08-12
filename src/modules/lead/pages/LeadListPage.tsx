import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  Pencil,
  MessageSquare,
  CheckCircle2,
  History,
  FileText,
  Trash2,
  MessageCircle,
  Mail,
  Phone,
  Upload,
} from "lucide-react";
import { ResourceListPage } from "@/modules/common/ResourceListPage";
import { LeadDialog } from "../components/LeadDialog";
import { FollowUpDialog } from "../components/FollowUpDialog";
import { ConvertLeadDialog } from "../components/ConvertLeadDialog";
import { LeadTimelineDialog } from "@/modules/activity/components/LeadTimelineDialog";
import { QuotationDialog } from "@/modules/quotation/components/QuotationDialog";
import { LeadImportDialog } from "../components/LeadImportDialog";
import { SendMessageDialog } from "@/modules/messaging/components/SendMessageDialog";
import { useLogCall } from "../hooks/useLeadWorkspace";
import type { MessageChannel } from "@/modules/messaging/types";
import { useLeads, useDeleteLead, useBulkDeleteLeads } from "../hooks/useLeads";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  LEAD_SOURCES,
  BULK_DELETABLE_LEAD_STATUSES,
  LABEL_COLOR_CLASSES,
} from "../constants/lead.constants";
import { useAppSelector } from "@/app/hooks";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type { Lead, LeadListQuery, LeadStatus, LeadSource } from "../types";
import type { QuotationPrefill } from "@/modules/quotation/types";

const filterSelectCls =
  "rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";
const filterInputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";

/** Blank quantity boxes must mean "no filter", not 0. */
function toQty(v: string): number | undefined {
  const n = Number(v);
  return v.trim() === "" || Number.isNaN(n) ? undefined : n;
}

/** Map a lead onto the seed values for a new quotation raised from its row. */
function leadToQuotationPrefill(lead: Lead): QuotationPrefill {
  return {
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
}

export function LeadListPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const canDelete = role === "admin";
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [source, setSource] = useState<LeadSource | "">("");
  const [location, setLocation] = useState("");
  const [minQty, setMinQty] = useState("");
  const [maxQty, setMaxQty] = useState("");

  // Follow-up dialog state (kept here since ResourceListPage owns its own dialog).
  const [followLead, setFollowLead] = useState<Lead | null>(null);
  const [followOpen, setFollowOpen] = useState(false);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [timelineLead, setTimelineLead] = useState<Lead | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [quotePrefill, setQuotePrefill] = useState<QuotationPrefill | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // Send dialog — one component, opened per channel from the row.
  const [sendTo, setSendTo] = useState<{ lead: Lead; channel: MessageChannel } | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const logCall = useLogCall();

  const bulkDelete = useBulkDeleteLeads();
  const [confirmBulk, setConfirmBulk] = useState<{ ids: string[]; clear: () => void } | null>(null);

  async function runBulkDelete() {
    if (!confirmBulk) return;
    try {
      const res = await bulkDelete.mutateAsync(confirmBulk.ids);
      toast.success(
        res.skipped
          ? `${res.deleted} lead(s) deleted, ${res.skipped} skipped`
          : `${res.deleted} lead(s) deleted`,
      );
      confirmBulk.clear();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
    setConfirmBulk(null);
  }

  // Only dead leads may be bulk-cleared, matching the server-side allowlist.
  const isRowSelectable = useCallback(
    (lead: Lead) => BULK_DELETABLE_LEAD_STATUSES.includes(lead.status),
    [],
  );

  return (
    <>
      {/* Point 7 — import with the data-format instructions shown first. */}
      {(role === "admin" || role === "manager") && (
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => setImportOpen(true)}
            data-testid="open-lead-import"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Upload className="h-4 w-4" /> Import Leads
          </button>
        </div>
      )}

      <ResourceListPage<Lead, LeadListQuery>
        title="Leads"
        subtitle="Generator enquiries and the lead-to-sale pipeline"
        newButtonText="New Lead"
        searchPlaceholder="Search by customer, mobile, city, requirement..."
        minTableWidth="min-w-[1500px]"
        emptyText="No leads found. Create your first lead."
        deleteConfirmText="Delete this lead? This removes it from the pipeline (history is retained)."
        columns={[
          {
            // Point 8 — date and time in the first row. For an imported lead the
            // enquiry timestamp at the source is the one the team cares about,
            // not when our poller happened to see it.
            header: "Received",
            getValue: (l) => (
              <span className="whitespace-nowrap text-xs font-medium">
                {formatDateTime(l.externalCreatedAt || l.createdAt)}
              </span>
            ),
          },
          {
            // Point 13 — clicking the lead opens its detail workspace.
            header: "Customer",
            getValue: (l) => (
              <div>
                <Link
                  to={`/leads/${l.id}`}
                  data-testid={`open-lead-${l.id}`}
                  className="font-medium text-foreground hover:text-primary hover:underline"
                >
                  {l.customerName}
                </Link>
                <div className="text-xs text-muted-foreground">{l.mobile || "-"}</div>
                {l.labels?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {l.labels.map((lb) => (
                      <span
                        key={lb.id}
                        className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          LABEL_COLOR_CLASSES[lb.color] ?? LABEL_COLOR_CLASSES.slate
                        }`}
                      >
                        {lb.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          {
            header: "Email",
            getValue: (l) =>
              l.email ? (
                <a
                  href={`mailto:${l.email}`}
                  className="text-primary hover:underline"
                  title={l.email}
                >
                  {l.email}
                </a>
              ) : (
                "-"
              ),
          },
          { header: "Location", getValue: (l) => l.city || "-" },
          {
            header: "Requirement",
            getValue: (l) => (
              <span className="block max-w-[220px] truncate" title={l.requirement}>
                {l.requirement || "-"}
              </span>
            ),
          },
          {
            header: "KVA",
            getValue: (l) => (l.requiredKva ? `${l.requiredKva}` : "-"),
            className: "font-mono",
          },
          { header: "Qty", getValue: (l) => l.quantity ?? 1, className: "font-mono" },
          {
            header: "Est. Value",
            getValue: (l) => (l.estimatedValue ? formatCurrency(l.estimatedValue) : "-"),
          },
          { header: "Source", getValue: (l) => LEAD_SOURCE_LABELS[l.source] },
          {
            header: "Status",
            getValue: (l) => (
              <span
                className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${LEAD_STATUS_COLORS[l.status]}`}
              >
                {LEAD_STATUS_LABELS[l.status]}
              </span>
            ),
          },
          { header: "Assigned", getValue: (l) => l.assignedTo?.name || "-" },
          {
            header: "Next Follow-up",
            getValue: (l) =>
              l.nextFollowUpDate ? (
                <span className="text-primary">{formatDate(l.nextFollowUpDate)}</span>
              ) : (
                "-"
              ),
          },
        ]}
        useList={useLeads}
        useDelete={canDelete ? useDeleteLead : undefined}
        buildQuery={({ search, page, limit }) => ({
          search: search || undefined,
          status: status || undefined,
          source: source || undefined,
          location: location.trim() || undefined,
          minQuantity: toQty(minQty),
          maxQuantity: toQty(maxQty),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page,
          limit,
        })}
        isRowSelectable={canDelete ? isRowSelectable : undefined}
        renderBulkActions={
          canDelete
            ? ({ ids, clear }) => (
                <button
                  onClick={() => setConfirmBulk({ ids, clear })}
                  disabled={bulkDelete.isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete selected
                </button>
              )
            : undefined
        }
        renderFilters={({ search, setSearch }) => (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Customer, mobile, city, requirement..."
                className={filterInputCls}
              />
            </div>
            <div className="min-w-[150px]">
              <label
                className="block text-xs font-medium text-muted-foreground mb-1"
                htmlFor="lead-location-filter"
              >
                Location
              </label>
              <input
                id="lead-location-filter"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City..."
                className={filterInputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Qty (min–max)
              </label>
              <div className="flex items-center gap-1">
                <input
                  aria-label="Minimum quantity"
                  type="number"
                  min={1}
                  value={minQty}
                  onChange={(e) => setMinQty(e.target.value)}
                  placeholder="Min"
                  className={`${filterInputCls} no-spinner w-20 text-right tabular-nums`}
                />
                <span className="text-muted-foreground">–</span>
                <input
                  aria-label="Maximum quantity"
                  type="number"
                  min={1}
                  value={maxQty}
                  onChange={(e) => setMaxQty(e.target.value)}
                  placeholder="Max"
                  className={`${filterInputCls} no-spinner w-20 text-right tabular-nums`}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Received between
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  aria-label="Received from"
                  data-testid="lead-start-date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`${filterInputCls} w-[140px]`}
                />
                <span className="text-muted-foreground">–</span>
                <input
                  type="date"
                  aria-label="Received to"
                  data-testid="lead-end-date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`${filterInputCls} w-[140px]`}
                />
              </div>
            </div>
            <div>
              <label
                className="block text-xs font-medium text-muted-foreground mb-1"
                htmlFor="lead-status-filter"
              >
                Status
              </label>
              <select
                id="lead-status-filter"
                className={filterSelectCls}
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus | "")}
              >
                <option value="">All</option>
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="block text-xs font-medium text-muted-foreground mb-1"
                htmlFor="lead-source-filter"
              >
                Source
              </label>
              <select
                id="lead-source-filter"
                className={filterSelectCls}
                value={source}
                onChange={(e) => setSource(e.target.value as LeadSource | "")}
              >
                <option value="">All</option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {LEAD_SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        renderActions={(lead, onEdit) => (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onEdit(lead)}
              className="flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button
              onClick={() => {
                setQuotePrefill(leadToQuotationPrefill(lead));
                setQuoteOpen(true);
              }}
              className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              title="Generate quotation for this lead"
            >
              <FileText className="h-3 w-3" /> Quote
            </button>
            {/* Point 1 — reach the customer straight from the row. */}
            <button
              onClick={() => setSendTo({ lead, channel: "whatsapp" })}
              data-testid={`whatsapp-${lead.id}`}
              className="flex items-center gap-1 rounded-md border border-green-500/30 bg-green-500/10 px-2 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-500/20 dark:text-green-400"
              title="Send a WhatsApp message"
            >
              <MessageCircle className="h-3 w-3" />
            </button>
            <button
              onClick={() => setSendTo({ lead, channel: "email" })}
              data-testid={`email-${lead.id}`}
              className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
              title="Send an email"
            >
              <Mail className="h-3 w-3" />
            </button>
            <a
              href={lead.mobile ? `tel:${lead.mobile}` : undefined}
              onClick={() => {
                // Opening the dialler is the call; log it so the engagement
                // counters and the lead history reflect the attempt.
                if (lead.mobile) logCall.mutate({ leadId: lead.id, outcome: "connected" });
              }}
              data-testid={`call-${lead.id}`}
              aria-disabled={!lead.mobile}
              className={`flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium transition-colors ${
                lead.mobile ? "hover:bg-accent" : "pointer-events-none opacity-40"
              }`}
              title={lead.mobile ? `Call ${lead.mobile}` : "No mobile number"}
            >
              <Phone className="h-3 w-3" />
            </a>
            <button
              onClick={() => {
                setFollowLead(lead);
                setFollowOpen(true);
              }}
              className="flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
              title="Follow-ups"
            >
              <MessageSquare className="h-3 w-3" />
              {lead.followUps.length > 0 ? lead.followUps.length : ""}
            </button>
            <button
              onClick={() => {
                setTimelineLead(lead);
                setTimelineOpen(true);
              }}
              className="flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
              title="Activity timeline"
            >
              <History className="h-3 w-3" />
            </button>
            {lead.status !== "converted" && lead.status !== "not_interested" && (
              <button
                onClick={() => {
                  setConvertLead(lead);
                  setConvertOpen(true);
                }}
                className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                title="Convert to sale"
              >
                <CheckCircle2 className="h-3 w-3" /> Convert
              </button>
            )}
          </div>
        )}
        renderDialog={({ open, onOpenChange, mode, value, onSuccess }) => (
          <LeadDialog
            open={open}
            onOpenChange={onOpenChange}
            mode={mode}
            value={value}
            onSuccess={onSuccess}
          />
        )}
      />

      <FollowUpDialog
        open={followOpen}
        onOpenChange={setFollowOpen}
        lead={followLead}
        onSuccess={() => undefined}
      />

      <ConvertLeadDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        lead={convertLead}
        onSuccess={() => undefined}
      />

      <LeadTimelineDialog
        open={timelineOpen}
        onOpenChange={setTimelineOpen}
        leadId={timelineLead?.id ?? null}
        leadName={timelineLead?.customerName}
      />

      {/* Raise a quotation straight off a lead row (Change Request point 1). */}
      <QuotationDialog
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        mode="create"
        value={null}
        defaultDocType="quotation"
        prefill={quotePrefill}
        onSuccess={() => setQuotePrefill(null)}
      />

      <LeadImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <SendMessageDialog
        open={Boolean(sendTo)}
        onOpenChange={(open) => !open && setSendTo(null)}
        channel={sendTo?.channel ?? "whatsapp"}
        leadId={sendTo?.lead.id}
        to={sendTo?.channel === "email" ? sendTo?.lead.email : sendTo?.lead.mobile}
      />

      {confirmBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-foreground">Delete Selected Leads</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Delete {confirmBulk.ids.length} lead(s)? Only leads marked Not Interested or
              Irrelevant are removed; history is retained.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmBulk(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={runBulkDelete}
                disabled={bulkDelete.isPending}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
