import { useEffect, useMemo, useState } from "react";
import { Check, Search, Trash2, Plus, ArrowLeft, ArrowRight, Zap } from "lucide-react";
import { FormDialog } from "@/modules/common/FormDialog";
import { useProductOptions } from "@/modules/product/hooks/useProducts";
import { useCreateQuotation } from "../hooks/useQuotations";
import { DEFAULT_TERMS, DOC_TYPE_LABELS } from "../constants/quotation.constants";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { formatCurrency } from "@/lib/utils";
import type { ProductOption } from "@/modules/product/types";
import type { DocType, Quotation, QuotationItemPayload, QuotationPrefill } from "../types";

/**
 * "Create your customized quotation" — Change Request point 15.
 *
 * A four-step wizard over the catalog, mirroring the IndiaMART flow the client
 * shared: pick products, confirm terms, verify the customer block, generate.
 * "Quick Generate" skips steps 2–3 for the common case.
 *
 * This sits alongside QuotationDialog rather than replacing it: the dialog is
 * still the right tool for a one-off, hand-typed document.
 */

const STEPS = [
  { n: 1, label: "Select Product" },
  { n: 2, label: "Terms & Conditions" },
  { n: 3, label: "Verify Details" },
  { n: 4, label: "Generate" },
] as const;

const inputCls =
  "w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";
const numCls = `${inputCls} no-spinner text-right tabular-nums`;

/** A product staged for the quotation, with per-line overrides. */
type Line = {
  option: ProductOption;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unit: string;
};

function toLine(option: ProductOption): Line {
  return {
    option,
    name: option.name,
    description: option.quotationDefaults.description,
    quantity: 1,
    unitPrice: option.quotationDefaults.unitPrice,
    unit: option.unit ?? "Piece",
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docType: DocType;
  /** Seed the customer block, e.g. when raised from a lead. */
  prefill?: QuotationPrefill | null;
  onSuccess: () => void;
}

export function QuotationWizard({ open, onOpenChange, docType, prefill, onSuccess }: Props) {
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [termsText, setTermsText] = useState(DEFAULT_TERMS.join("\n"));
  const [notes, setNotes] = useState("");
  const [customer, setCustomer] = useState({
    customerName: "",
    customerMobile: "",
    customerEmail: "",
    customerAddress: "",
    customerGstin: "",
    customerState: "",
  });
  const [isInterState, setIsInterState] = useState(false);

  const createMutation = useCreateQuotation();
  const { data: options, isLoading } = useProductOptions(search, open && step === 1);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSearch("");
    setLines([]);
    setTermsText(DEFAULT_TERMS.join("\n"));
    setNotes("");
    setIsInterState(false);
    setCustomer({
      customerName: prefill?.customerName ?? "",
      customerMobile: prefill?.customerMobile ?? "",
      customerEmail: prefill?.customerEmail ?? "",
      customerAddress: prefill?.customerAddress ?? "",
      customerGstin: "",
      customerState: prefill?.customerState ?? "",
    });
  }, [open, prefill]);

  const selectedIds = useMemo(() => new Set(lines.map((l) => l.option.id)), [lines]);

  const totals = useMemo(() => {
    let taxable = 0;
    let tax = 0;
    for (const l of lines) {
      const gross = l.quantity * l.unitPrice;
      taxable += gross;
      tax += (gross * (l.option.quotationDefaults.taxRate ?? 18)) / 100;
    }
    return { taxable, tax, grand: Math.round(taxable + tax) };
  }, [lines]);

  function toggleProduct(option: ProductOption) {
    setLines((prev) =>
      prev.some((l) => l.option.id === option.id)
        ? prev.filter((l) => l.option.id !== option.id)
        : [...prev, toLine(option)],
    );
  }

  function patchLine(id: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.option.id === id ? { ...l, ...patch } : l)));
  }

  function buildItems(): QuotationItemPayload[] {
    return lines.map((l) => ({
      description: l.description || l.name,
      model: l.option.quotationDefaults.model,
      kva: l.option.kva,
      hsnCode: l.option.quotationDefaults.hsnCode,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRate: l.option.quotationDefaults.taxRate,
      unit: l.unit,
      product: l.option.id,
      imageUrl: l.option.primaryImageUrl ?? undefined,
      specs: l.option.specs?.length ? l.option.specs : undefined,
    }));
  }

  async function generate() {
    if (!lines.length) {
      toast.error("Select at least one product");
      setStep(1);
      return;
    }
    if (!customer.customerName.trim()) {
      toast.error("Customer name is required");
      setStep(3);
      return;
    }
    try {
      // createResourceHooks widens its mutation result to `unknown`; the
      // underlying api.create does return the created document.
      const created = (await createMutation.mutateAsync({
        docType,
        customerName: customer.customerName.trim(),
        customerMobile: customer.customerMobile || undefined,
        customerEmail: customer.customerEmail || undefined,
        customerAddress: customer.customerAddress || undefined,
        customerGstin: customer.customerGstin || undefined,
        customerState: customer.customerState || undefined,
        isInterState,
        items: buildItems(),
        terms: termsText
          .split("\n")
          .map((t) => t.trim())
          .filter(Boolean),
        notes: notes || undefined,
      })) as Quotation;
      toast.success(`${DOC_TYPE_LABELS[docType]} ${created.docNumberFormatted} created`);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  /** Skip the terms/verify steps for the common repeat case. */
  function quickGenerate() {
    if (!customer.customerName.trim()) {
      setStep(3);
      toast.error("Customer name is required before generating");
      return;
    }
    void generate();
  }

  const canAdvance = step !== 1 || lines.length > 0;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Create your customized ${DOC_TYPE_LABELS[docType].toLowerCase()}`}
      size="xl"
      hideFooter
    >
      <div className="flex flex-col gap-4 md:flex-row" data-testid="quotation-wizard">
        {/* Step rail */}
        <aside className="w-full shrink-0 md:w-52">
          <ol className="space-y-1">
            {STEPS.map((s) => {
              const done = step > s.n;
              const active = step === s.n;
              return (
                <li key={s.n}>
                  <button
                    type="button"
                    onClick={() => (s.n < step || canAdvance) && setStep(s.n)}
                    data-testid={`wizard-step-${s.n}`}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "bg-primary/10 font-medium text-primary"
                        : done
                          ? "text-foreground hover:bg-accent"
                          : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                        done
                          ? "bg-primary text-primary-foreground"
                          : active
                            ? "border-2 border-primary text-primary"
                            : "border border-border"
                      }`}
                    >
                      {done ? <Check className="h-3 w-3" /> : s.n}
                    </span>
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
            <div className="text-muted-foreground">Selected</div>
            <div className="text-lg font-bold text-primary">{lines.length}</div>
            <div className="mt-1 text-muted-foreground">
              Est. total{" "}
              <span className="font-semibold text-foreground">{formatCurrency(totals.grand)}</span>
            </div>
          </div>
        </aside>

        {/* Step body */}
        <div className="min-w-0 flex-1">
          {step === 1 && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your catalog..."
                  aria-label="Search your catalog"
                  className="w-full rounded-lg border border-input bg-background py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="max-h-[38vh] space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : !options?.length ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {search ? "No matching products." : "The catalog is empty."}
                  </p>
                ) : (
                  options.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggleProduct(o)}
                      data-testid={`wizard-product-${o.id}`}
                      aria-pressed={selectedIds.has(o.id)}
                      className={`flex w-full items-center gap-2.5 rounded-md border p-2 text-left transition-colors ${
                        selectedIds.has(o.id)
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:bg-accent"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          selectedIds.has(o.id)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input"
                        }`}
                      >
                        {selectedIds.has(o.id) && <Check className="h-3 w-3" />}
                      </span>
                      {o.primaryImageUrl ? (
                        <img
                          src={o.primaryImageUrl}
                          alt=""
                          loading="lazy"
                          className="h-9 w-9 shrink-0 rounded border border-border object-cover"
                        />
                      ) : (
                        <span className="h-9 w-9 shrink-0 rounded border border-border bg-muted/40" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{o.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[o.brand, o.modelCode, o.kva ? `${o.kva} kVA` : null]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold">
                        {formatCurrency(o.price)}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {lines.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">
                    SELECTED — edit name, quantity, price and description per line
                  </div>
                  {lines.map((l) => (
                    <div key={l.option.id} className="rounded-lg border border-border p-2">
                      <div className="grid grid-cols-[1fr_70px_100px_70px_28px] gap-2">
                        <input
                          className={inputCls}
                          value={l.name}
                          aria-label={`Product name for ${l.option.name}`}
                          onChange={(e) => patchLine(l.option.id, { name: e.target.value })}
                        />
                        <input
                          type="number"
                          min={1}
                          className={numCls}
                          value={l.quantity}
                          aria-label={`Quantity for ${l.option.name}`}
                          onChange={(e) =>
                            patchLine(l.option.id, { quantity: Number(e.target.value) || 1 })
                          }
                        />
                        <input
                          type="number"
                          className={numCls}
                          value={l.unitPrice}
                          aria-label={`Price for ${l.option.name}`}
                          onChange={(e) =>
                            patchLine(l.option.id, { unitPrice: Number(e.target.value) || 0 })
                          }
                        />
                        <input
                          className={inputCls}
                          value={l.unit}
                          aria-label={`Unit for ${l.option.name}`}
                          onChange={(e) => patchLine(l.option.id, { unit: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => toggleProduct(l.option)}
                          aria-label={`Remove ${l.option.name}`}
                          className="flex items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        className={`${inputCls} mt-2 leading-relaxed`}
                        value={l.description}
                        aria-label={`Description for ${l.option.name}`}
                        onChange={(e) => patchLine(l.option.id, { description: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <label
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                  htmlFor="wizard-terms"
                >
                  Terms &amp; Conditions (one per line)
                </label>
                <textarea
                  id="wizard-terms"
                  rows={8}
                  className={`${inputCls} leading-relaxed`}
                  value={termsText}
                  onChange={(e) => setTermsText(e.target.value)}
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                  htmlFor="wizard-notes"
                >
                  Notes
                </label>
                <textarea
                  id="wizard-notes"
                  rows={3}
                  className={inputCls}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                  htmlFor="wizard-customer-name"
                >
                  Customer Name *
                </label>
                <input
                  id="wizard-customer-name"
                  className={inputCls}
                  value={customer.customerName}
                  onChange={(e) => setCustomer((c) => ({ ...c, customerName: e.target.value }))}
                />
              </div>
              {(
                [
                  ["customerMobile", "Mobile"],
                  ["customerEmail", "Email"],
                  ["customerGstin", "GSTIN"],
                  ["customerState", "State"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                    htmlFor={`wizard-${key}`}
                  >
                    {label}
                  </label>
                  <input
                    id={`wizard-${key}`}
                    className={inputCls}
                    value={customer[key]}
                    onChange={(e) => setCustomer((c) => ({ ...c, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                  htmlFor="wizard-customerAddress"
                >
                  Address
                </label>
                <input
                  id="wizard-customerAddress"
                  className={inputCls}
                  value={customer.customerAddress}
                  onChange={(e) => setCustomer((c) => ({ ...c, customerAddress: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={isInterState}
                  onChange={(e) => setIsInterState(e.target.checked)}
                />
                Inter-state (IGST)
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">SUMMARY</div>
                <dl className="grid grid-cols-2 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Document</dt>
                  <dd className="text-right font-medium">{DOC_TYPE_LABELS[docType]}</dd>
                  <dt className="text-muted-foreground">Customer</dt>
                  <dd className="text-right font-medium">{customer.customerName || "—"}</dd>
                  <dt className="text-muted-foreground">Line items</dt>
                  <dd className="text-right font-medium">{lines.length}</dd>
                  <dt className="text-muted-foreground">Taxable</dt>
                  <dd className="text-right font-medium">{formatCurrency(totals.taxable)}</dd>
                  <dt className="text-muted-foreground">{isInterState ? "IGST" : "CGST + SGST"}</dt>
                  <dd className="text-right font-medium">{formatCurrency(totals.tax)}</dd>
                  <dt className="font-semibold text-foreground">Grand Total</dt>
                  <dd className="text-right text-base font-bold text-primary">
                    {formatCurrency(totals.grand)}
                  </dd>
                </dl>
              </div>
              <p className="text-xs text-muted-foreground">
                The server recomputes every figure on save; this preview is a guide.
              </p>
            </div>
          )}

          {/* Wizard nav */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={quickGenerate}
                disabled={!lines.length || createMutation.isPending}
                data-testid="wizard-quick-generate"
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                title="Skip the terms and verify steps"
              >
                <Zap className="h-4 w-4" /> Quick Generate
              </button>

              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(4, s + 1))}
                  disabled={!canAdvance}
                  data-testid="wizard-next"
                  className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-40"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={generate}
                  disabled={createMutation.isPending}
                  data-testid="wizard-generate"
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {createMutation.isPending ? "Generating..." : "Generate"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </FormDialog>
  );
}
