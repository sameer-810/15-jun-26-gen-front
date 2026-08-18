import { useState } from "react";
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
  UserPlus,
} from "lucide-react";
import { ResourceListPage } from "@/modules/common/ResourceListPage";
import { LeadDialog } from "../components/LeadDialog";
import { FollowUpDialog } from "../components/FollowUpDialog";
import { ConvertLeadDialog } from "../components/ConvertLeadDialog";
import { LeadTimelineDialog } from "@/modules/activity/components/LeadTimelineDialog";
import { QuotationDialog } from "@/modules/quotation/components/QuotationDialog";
import { LeadImportDialog } from "../components/LeadImportDialog";
import { LeadCitySelect } from "../components/LeadCitySelect";
import { SendMessageDialog } from "@/modules/messaging/components/SendMessageDialog";
import { useLogCall } from "../hooks/useLeadWorkspace";
import type { MessageChannel } from "@/modules/messaging/types";
import {
  useLeads,
  useDeleteLead,
  useBulkDeleteLeads,
  useBulkAssignLeads,
  useAssignableUsers,
} from "../hooks/useLeads";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  LEAD_SOURCES,
  BULK_DELETABLE_LEAD_STATUSES,
  LABEL_COLOR_CLASSES,
  CALL_OUTCOMES,
  CALL_OUTCOME_LABELS,
} from "../constants/lead.constants";
import { useAppSelector } from "@/app/hooks";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type { Lead, LeadListQuery, LeadStatus, LeadSource, CallFilter } from "../types";
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
  // Distributing leads across the team is a sales-manager job, so managers get
  // it too. Matches the guard on POST /leads/bulk-assign.
  const canAssign = role === "admin" || role === "manager";
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
  // Answered / unanswered toggle (SRS 3.2). "" is all leads.
  const [callFilter, setCallFilter] = useState<CallFilter | "">("");
  const logCall = useLogCall();
  // The lead we are waiting on a call outcome for. See the call button below.
  const [callOutcomeFor, setCallOutcomeFor] = useState<Lead | null>(null);

  /**
   * Record the attempt. `outcome` is undefined when the user dismisses the
   * prompt — the call still happened and still belongs in the history, we just
   * do not know how it went. The backend already treats outcome as optional,
   * so "attempted, result unknown" is a state the data can represent honestly
   * instead of being rounded up to "connected".
   */
  async function recordCall(outcome?: string) {
    const lead = callOutcomeFor;
    if (!lead) return;
    setCallOutcomeFor(null);
    try {
      await logCall.mutateAsync({ leadId: lead.id, outcome: outcome as never });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  const bulkDelete = useBulkDeleteLeads();
  const [confirmBulk, setConfirmBulk] = useState<{ ids: string[]; clear: () => void } | null>(null);

  const bulkAssign = useBulkAssignLeads();
  const [assignBulk, setAssignBulk] = useState<{ ids: string[]; clear: () => void } | null>(null);
  const [assignTo, setAssignTo] = useState("");
  // Only fetched once the dialog is open — this is a rarely used control and
  // the list is otherwise dead weight on every leads page load.
  const assignableUsers = useAssignableUsers(Boolean(assignBulk));

  async function runBulkAssign() {
    if (!assignBulk) return;
    try {
      const res = await bulkAssign.mutateAsync({
        ids: assignBulk.ids,
        // "" is the un-assign option in the select; the API wants null.
        assignedTo: assignTo || null,
      });
      toast.success(
        res.assignedTo
          ? `${res.updated} lead(s) assigned to ${res.assignedTo}`
          : `${res.updated} lead(s) returned to the pool`,
      );
      assignBulk.clear();
      setAssignBulk(null);
      setAssignTo("");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

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
        // The row is 1500px wide and the customer name was the only 120px of it
        // that opened the lead. Clicking anywhere in the row now does, exactly
        // as it does in Salesforce or HubSpot — the name stays a real link, so
        // keyboard users and "open in new tab" are unaffected.
        rowHref={(l) => `/leads/${l.id}`}
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
                {/*
                  "The lead view must clearly display which employee initiated
                  the action" (SRS 3.2). Shown here rather than in its own
                  column because it is only meaningful next to the customer it
                  refers to, and the table is already 1500px wide.
                */}
                {l.lastCallByName && (
                  <div className="mt-0.5 text-xs">
                    <span
                      className={
                        l.lastCallOutcome === "connected"
                          ? "text-success"
                          : l.lastCallOutcome
                            ? "text-warning"
                            : "text-muted-foreground"
                      }
                    >
                      {l.lastCallOutcome
                        ? CALL_OUTCOME_LABELS[l.lastCallOutcome]
                        : "Called, outcome not recorded"}
                    </span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {l.lastCallByName}
                      {l.callCount && l.callCount > 1 ? (
                        <span className="font-mono tabular-nums"> ({l.callCount})</span>
                      ) : null}
                    </span>
                  </div>
                )}
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
          callFilter: callFilter || undefined,
          page,
          limit,
        })}
        /*
          Selection used to be admin-only and limited to dead leads, because
          delete was the only bulk action. Assignment (SRS 3.2) applies to live
          leads and is a sales-manager job, so any lead is now selectable and
          each action decides its own eligibility from the selection.
        */
        isRowSelectable={canAssign || canDelete ? () => true : undefined}
        renderBulkActions={
          canAssign || canDelete
            ? ({ ids, items, clear }) => {
                // The server refuses anything that isn't already dead, so
                // offering Delete on a live selection would only produce a
                // "0 deleted, 12 skipped" toast. Say why up front instead.
                const deletable = items.filter((l) =>
                  BULK_DELETABLE_LEAD_STATUSES.includes(l.status),
                );
                return (
                  <>
                    {canAssign && (
                      <button
                        data-testid="bulk-assign-open"
                        onClick={() => setAssignBulk({ ids, clear })}
                        disabled={bulkAssign.isPending}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Assign to…
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => setConfirmBulk({ ids, clear })}
                        disabled={bulkDelete.isPending || deletable.length === 0}
                        title={
                          deletable.length === 0
                            ? "Only leads marked Not Interested or Irrelevant can be deleted"
                            : `${deletable.length} of ${items.length} can be deleted`
                        }
                        className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete selected
                      </button>
                    )}
                  </>
                );
              }
            : undefined
        }
        renderFilters={({ search, setSearch }) => (
          <div className="pg-tile flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Customer, mobile, city, requirement..."
                className={filterInputCls}
              />
            </div>

            {/*
              Calling filter — SRS 3.2. A segmented control rather than a select
              because these four are the whole vocabulary and a salesperson
              flips between them constantly; a dropdown costs two clicks each
              time to show four options.
            */}
            <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Calls</span>
              <div className="inline-flex overflow-hidden rounded-lg border border-input">
                {(
                  [
                    { key: "", label: "All" },
                    { key: "answered", label: "Answered" },
                    { key: "unanswered", label: "Unanswered" },
                    { key: "not_called", label: "Not called" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key || "all"}
                    type="button"
                    data-testid={`call-filter-${opt.key || "all"}`}
                    aria-pressed={callFilter === opt.key}
                    onClick={() => setCallFilter(opt.key)}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      callFilter === opt.key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-w-[150px]">
              <label
                className="block text-xs font-medium text-muted-foreground mb-1"
                htmlFor="lead-location-filter"
              >
                Location
              </label>
              <LeadCitySelect
                id="lead-location-filter"
                data-testid="lead-location-filter"
                value={location}
                onChange={setLocation}
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
                /*
                  Opening the dialler starts the call; the *result* of it is not
                  knowable yet, so we ask once the user comes back.

                  This used to fire `logCall({ outcome: "connected" })` right
                  here, which recorded every attempt as answered whether anyone
                  picked up or not. That made the answered-vs-unanswered figures
                  the SRS asks for (3.2) not merely inaccurate but inverted —
                  they would have read 100% answered forever, and looked
                  entirely plausible while staff were judged on them.
                */
                if (lead.mobile) setCallOutcomeFor(lead);
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

      {/*
        Call outcome prompt.

        Deliberately unskippable-by-accident but trivially skippable on purpose:
        "Not sure" records the attempt with no outcome. The one thing it must
        never do is guess, because everything the SRS asks for in 3.2 — the
        answered/unanswered filter and the daily report — is built on this
        single field.
      */}
      {callOutcomeFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="pg-overlay w-full max-w-sm p-6" role="dialog" aria-modal="true">
            <h3 className="text-base font-semibold text-foreground">How did the call go?</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {callOutcomeFor.customerName}
              {callOutcomeFor.mobile ? (
                <span className="font-mono tabular-nums"> · {callOutcomeFor.mobile}</span>
              ) : null}
            </p>
            <div className="mt-4 grid gap-1.5">
              {CALL_OUTCOMES.map((o) => (
                <button
                  key={o}
                  data-testid={`call-outcome-${o}`}
                  onClick={() => recordCall(o)}
                  disabled={logCall.isPending}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-accent disabled:opacity-50"
                >
                  {CALL_OUTCOME_LABELS[o]}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                data-testid="call-outcome-unknown"
                onClick={() => recordCall(undefined)}
                disabled={logCall.isPending}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                Not sure — just log the attempt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk assignment — SRS 3.2. */}
      {assignBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="pg-overlay w-full max-w-sm p-6" role="dialog" aria-modal="true">
            <h3 className="text-base font-semibold text-foreground">Assign Leads</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Reassign <span className="font-mono tabular-nums">{assignBulk.ids.length}</span>{" "}
              selected lead
              {assignBulk.ids.length === 1 ? "" : "s"}. The current owner is replaced.
            </p>

            <label
              htmlFor="bulk-assign-to"
              className="mt-4 mb-1 block text-xs font-medium text-muted-foreground"
            >
              Assign to
            </label>
            <select
              id="bulk-assign-to"
              data-testid="bulk-assign-select"
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Nobody — return to the pool</option>
              {(assignableUsers.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            {assignableUsers.isLoading && (
              <p className="mt-1.5 text-xs text-muted-foreground">Loading team…</p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => {
                  setAssignBulk(null);
                  setAssignTo("");
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                data-testid="bulk-assign-confirm"
                onClick={runBulkAssign}
                disabled={bulkAssign.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {bulkAssign.isPending ? "Assigning…" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="pg-overlay w-full max-w-sm p-6">
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
