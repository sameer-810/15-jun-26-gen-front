import { useState } from "react";
import {
  Pencil,
  FileText,
  MessageCircle,
  Download,
  Lock,
  ArrowRightCircle,
  Wand2,
  Mail,
} from "lucide-react";
import { ResourceListPage } from "@/modules/common/ResourceListPage";
import { QuotationDialog } from "../components/QuotationDialog";
import { QuotationWizard } from "../components/QuotationWizard";
import { SendMessageDialog } from "@/modules/messaging/components/SendMessageDialog";
import type { MessageChannel } from "@/modules/messaging/types";
import {
  useQuotations,
  useDeleteQuotation,
  useSetQuotationStatus,
  useIssueQuotation,
  useConvertQuotation,
} from "../hooks/useQuotations";
import { quotationPdfPath } from "../api/quotationApi";
import {
  DOC_STATUS_LABELS,
  DOC_STATUS_COLORS,
  DOC_STATUSES,
  DOC_TYPE_LABELS,
  DOC_TYPE_PLURALS,
  DOC_TYPES,
} from "../constants/quotation.constants";
import { openAuthenticatedPdf, downloadAuthenticatedPdf } from "@/shared/lib/openAuthenticatedPdf";
import { useAppSelector } from "@/app/hooks";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Quotation, QuotationListQuery, DocType, DocStatus } from "../types";

const TABS: { key: DocType; label: string }[] = DOC_TYPES.map((key) => ({
  key,
  label: DOC_TYPE_PLURALS[key],
}));

export function QuotationListPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const canDelete = role === "admin";
  // Issuing locks a tax invoice for good, so it is a manager-level action —
  // mirrors the server-side guard on POST /quotations/:id/issue.
  const canIssue = role === "admin" || role === "manager";
  const [docType, setDocType] = useState<DocType>("quotation");
  const statusMutation = useSetQuotationStatus();
  const issueMutation = useIssueQuotation();
  const convertMutation = useConvertQuotation();
  const [confirmIssue, setConfirmIssue] = useState<Quotation | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  // Point 2 — share the document itself, not a note promising one.
  const [share, setShare] = useState<{ doc: Quotation; channel: MessageChannel } | null>(null);
  // ResourceListPage owns its own paging/query state, so bumping this key is
  // how an outside creation (the wizard) forces it to reload.
  const [listRefreshKey, setListRefreshKey] = useState(0);

  async function convertToInvoice(q: Quotation) {
    try {
      const created = await convertMutation.mutateAsync({ id: q.id, targetType: "invoice" });
      toast.success(
        `Tax invoice ${created.docNumberFormatted} created from ${q.docNumberFormatted}`,
      );
      setDocType("invoice");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function issue() {
    if (!confirmIssue) return;
    try {
      const issued = await issueMutation.mutateAsync(confirmIssue.id);
      toast.success(`${issued.docNumberFormatted} issued`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
    setConfirmIssue(null);
  }

  async function viewPdf(q: Quotation) {
    try {
      await openAuthenticatedPdf(quotationPdfPath(q.id));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function downloadPdf(q: Quotation) {
    try {
      await downloadAuthenticatedPdf(quotationPdfPath(q.id), `${q.docNumberFormatted}.pdf`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function changeStatus(q: Quotation, status: DocStatus) {
    try {
      await statusMutation.mutateAsync({ id: q.id, status });
      toast.success(`Marked ${DOC_STATUS_LABELS[status]}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setDocType(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              docType === t.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-card hover:bg-accent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Point 15 — the catalog-driven builder, alongside the plain dialog. */}
      <div className="flex justify-end">
        <button
          onClick={() => setWizardOpen(true)}
          data-testid="open-wizard"
          className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          <Wand2 className="h-4 w-4" /> Build from catalog
        </button>
      </div>

      <ResourceListPage<Quotation, QuotationListQuery>
        key={`${docType}-${listRefreshKey}`}
        title={DOC_TYPE_PLURALS[docType]}
        subtitle={
          docType === "invoice"
            ? "Statutory GST invoices — numbered per financial year and locked once issued"
            : "GST-enabled documents with PDF & share"
        }
        newButtonText={`New ${DOC_TYPE_LABELS[docType]}`}
        searchPlaceholder="Search by customer or number..."
        minTableWidth="min-w-[1100px]"
        // No detail route for a quotation, so opening the record means the
        // editor — the same thing the row's Edit button does.
        rowOpensEditor
        emptyText="No documents yet. Create your first one."
        deleteConfirmText="Delete this document? This cannot be undone."
        columns={[
          {
            header: "Number",
            getValue: (q) => (
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-semibold text-primary">{q.docNumberFormatted}</span>
                {q.isIssued && (
                  <span
                    title={`Issued ${q.issuedAt ? formatDate(q.issuedAt) : ""} — read-only`}
                    className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  >
                    <Lock className="h-2.5 w-2.5" /> Issued
                  </span>
                )}
              </div>
            ),
          },
          { header: "Date", getValue: (q) => formatDate(q.date) },
          {
            header: "Customer",
            getValue: (q) => <span className="font-medium">{q.customerName}</span>,
          },
          { header: "Items", getValue: (q) => q.items.length },
          { header: "Taxable", getValue: (q) => formatCurrency(q.taxableValue) },
          {
            header: "GST",
            getValue: (q) =>
              q.isInterState ? `IGST ${formatCurrency(q.igst)}` : formatCurrency(q.cgst + q.sgst),
          },
          {
            header: "Grand Total",
            getValue: (q) => <span className="font-semibold">{formatCurrency(q.grandTotal)}</span>,
          },
          {
            header: "Status",
            getValue: (q) => (
              <select
                value={q.status}
                aria-label={`Status of ${q.docNumberFormatted}`}
                onChange={(e) => changeStatus(q, e.target.value as DocStatus)}
                className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium focus:ring-1 focus:ring-ring ${DOC_STATUS_COLORS[q.status]}`}
              >
                {DOC_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {DOC_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            ),
          },
        ]}
        useList={useQuotations}
        useDelete={canDelete ? useDeleteQuotation : undefined}
        buildQuery={({ search, page, limit }) => ({
          search: search || undefined,
          docType,
          page,
          limit,
        })}
        renderActions={(q, onEdit) => (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(q)}
              disabled={q.isIssued}
              className="rounded-md border border-border bg-background p-1.5 hover:bg-accent transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              title={q.isIssued ? "Issued invoices cannot be edited" : "Edit"}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => viewPdf(q)}
              className="rounded-md border border-border bg-background p-1.5 hover:bg-accent transition-colors"
              title="View PDF"
            >
              <FileText className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => downloadPdf(q)}
              className="rounded-md border border-border bg-background p-1.5 hover:bg-accent transition-colors"
              title="Download PDF"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShare({ doc: q, channel: "whatsapp" })}
              data-testid={`share-whatsapp-${q.id}`}
              className="rounded-md border border-green-500/30 bg-green-500/10 p-1.5 text-green-600 transition-colors hover:bg-green-500/20"
              title="Send this document on WhatsApp"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShare({ doc: q, channel: "email" })}
              data-testid={`share-email-${q.id}`}
              className="rounded-md border border-border bg-background p-1.5 transition-colors hover:bg-accent"
              title="Email this document"
            >
              <Mail className="h-3.5 w-3.5" />
            </button>

            {/* PI → Tax Invoice (point 10) */}
            {q.docType === "proforma" && (
              <button
                onClick={() => convertToInvoice(q)}
                disabled={convertMutation.isPending}
                data-testid={`convert-${q.id}`}
                className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                title="Raise a tax invoice from this proforma"
              >
                <ArrowRightCircle className="h-3.5 w-3.5" /> Invoice
              </button>
            )}

            {/* Finalise a tax invoice — irreversible, hence the confirm step. */}
            {q.docType === "invoice" && !q.isIssued && canIssue && (
              <button
                onClick={() => setConfirmIssue(q)}
                data-testid={`issue-${q.id}`}
                className="flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
                title="Issue this invoice — it becomes read-only"
              >
                <Lock className="h-3.5 w-3.5" /> Issue
              </button>
            )}
          </div>
        )}
        renderDialog={({ open, onOpenChange, mode, value, onSuccess }) => (
          <QuotationDialog
            open={open}
            onOpenChange={onOpenChange}
            mode={mode}
            value={value}
            defaultDocType={docType}
            onSuccess={onSuccess}
          />
        )}
      />

      <QuotationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        docType={docType}
        onSuccess={() => setListRefreshKey((k) => k + 1)}
      />

      <SendMessageDialog
        open={Boolean(share)}
        onOpenChange={(open) => !open && setShare(null)}
        channel={share?.channel ?? "whatsapp"}
        leadId={share?.doc.leadId ?? undefined}
        to={share?.channel === "email" ? share?.doc.customerEmail : share?.doc.customerMobile}
        documentId={share?.doc.id}
        documentLabel={share?.doc.docNumberFormatted}
      />

      {confirmIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="pg-overlay w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-foreground">
              Issue {confirmIssue.docNumberFormatted}?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Issuing finalises this tax invoice. It cannot be edited or deleted afterwards — a
              correction then requires a credit note. Check the customer details, line items and
              totals first.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmIssue(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={issue}
                disabled={issueMutation.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                Issue Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
