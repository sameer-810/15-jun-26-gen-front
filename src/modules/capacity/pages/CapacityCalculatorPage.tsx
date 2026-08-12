import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Calculator, FileText, Plus, Trash2, Zap } from "lucide-react";
import { useCalculateCapacity } from "../hooks/useCapacity";
import type { ApplianceCategory, ApplianceInput, CapacityResult } from "../types";
import { useGensetSuggestions } from "@/modules/product/hooks/useProducts";
import { useLeadWorkspace } from "@/modules/lead/hooks/useLeadWorkspace";
import { QuotationDialog } from "@/modules/quotation/components/QuotationDialog";
import type { ProductOption } from "@/modules/product/types";
import type { QuotationPrefill } from "@/modules/quotation/types";
import { getApiErrorMessage } from "@/shared/api/http";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/shared/lib/toast";

const CATEGORY_LABELS: Record<ApplianceCategory, string> = {
  lighting: "Lighting",
  fan: "Fan",
  ac: "Air Conditioner",
  motor: "Motor",
  pump: "Pump",
  refrigeration: "Refrigeration",
  heating: "Heating",
  other: "Other",
};
const CATEGORIES = Object.keys(CATEGORY_LABELS) as ApplianceCategory[];

const inputCls =
  "w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";

type Row = { category: ApplianceCategory; name: string; quantity: number; watts: number };

const STARTER_ROWS: Row[] = [
  { category: "lighting", name: "LED lights", quantity: 10, watts: 15 },
  { category: "fan", name: "Ceiling fans", quantity: 5, watts: 75 },
  { category: "ac", name: "1.5 Ton AC", quantity: 1, watts: 1500 },
];

/**
 * The line item a quotation starts from when the catalog has nothing at this
 * rating — the sizing itself, written out so the customer can see the working.
 */
function describeLoad(result: CapacityResult): string {
  const load = result.items.map((it) => `${it.quantity} x ${it.name} (${it.watts} W)`).join(", ");
  return [
    `${result.recommendedStandardKva} kVA diesel generator set`,
    `Sized for a running load of ${result.runningKva} kVA and a peak of ${result.peakKva} kVA ` +
      `at ${result.inputs.powerFactor} power factor, including a ${result.inputs.safetyMarginPct}% safety margin.`,
    `Connected load: ${load}.`,
  ].join("\n");
}

export function CapacityCalculatorPage() {
  const [params] = useSearchParams();
  // Reached from a lead's "Calculate" button — the quotation then carries the
  // customer through, so nothing is retyped (point 4: calculate, then quote).
  const leadId = params.get("leadId") ?? undefined;
  const { data: workspace } = useLeadWorkspace(leadId);
  const lead = workspace?.lead;

  const [rows, setRows] = useState<Row[]>(STARTER_ROWS);
  const [powerFactor, setPowerFactor] = useState(0.8);
  const [safetyMargin, setSafetyMargin] = useState(25);
  const [result, setResult] = useState<CapacityResult | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const calc = useCalculateCapacity();

  // Only gensets that can actually carry the calculated load, smallest first.
  const { data: suggestions } = useGensetSuggestions(result?.recommendedStandardKva ?? null);
  const picked: ProductOption | null = suggestions?.find((s) => s.id === pickedId) ?? null;

  const quotePrefill: QuotationPrefill | null = useMemo(() => {
    if (!result) return null;
    const defaults = picked?.quotationDefaults;
    return {
      customerName: lead?.customerName ?? "",
      customerMobile: lead?.mobile,
      customerEmail: lead?.email,
      customerAddress: lead?.address,
      customerState: lead?.state,
      description: defaults?.description || describeLoad(result),
      kva: defaults?.kva ?? result.recommendedStandardKva,
      quantity: 1,
      unitPrice: defaults?.unitPrice ?? 0,
    };
  }, [result, picked, lead]);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function addRow() {
    setRows((r) => [...r, { category: "other", name: "", quantity: 1, watts: 0 }]);
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function onCalculate() {
    const appliances: ApplianceInput[] = rows
      .filter((r) => r.watts > 0 && r.quantity > 0)
      .map((r) => ({
        category: r.category,
        name: r.name || CATEGORY_LABELS[r.category],
        quantity: Number(r.quantity),
        watts: Number(r.watts),
      }));
    if (appliances.length === 0) {
      toast.error("Add at least one appliance with watts and quantity");
      return;
    }
    try {
      const res = await calc.mutateAsync({
        appliances,
        powerFactor: Number(powerFactor),
        safetyMarginPct: Number(safetyMargin),
      });
      setResult(res);
      // A new sizing invalidates the genset picked against the old one.
      setPickedId(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="erp-page max-w-5xl">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Generator Capacity Calculator</h1>
          <p className="text-sm text-muted-foreground">
            Enter the connected load to get a recommended genset size (with motor start-up surge and
            safety margin), then quote it
          </p>
          {lead && (
            <p className="mt-1 text-sm font-medium text-primary" data-testid="calc-for-lead">
              Sizing for {lead.customerName}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="overflow-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">Category</th>
                <th className="px-2 py-2 font-medium">Appliance</th>
                <th className="px-2 py-2 font-medium w-24">Qty</th>
                <th className="px-2 py-2 font-medium w-32">Watts (each)</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="px-2 py-1.5">
                    <select
                      className={inputCls}
                      value={row.category}
                      onChange={(e) =>
                        updateRow(i, { category: e.target.value as ApplianceCategory })
                      }
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={inputCls}
                      value={row.name}
                      placeholder="e.g. Submersible pump"
                      onChange={(e) => updateRow(i, { name: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={1}
                      className={inputCls}
                      value={row.quantity}
                      onChange={(e) => updateRow(i, { quantity: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      className={inputCls}
                      value={row.watts}
                      onChange={(e) => updateRow(i, { watts: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => removeRow(i)}
                      className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                      aria-label="Remove row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={addRow}
          className="mt-2 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <Plus className="h-4 w-4" /> Add appliance
        </button>

        <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-border pt-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Power Factor
            </label>
            <input
              type="number"
              step="0.05"
              min={0.1}
              max={1}
              className={`${inputCls} w-28`}
              value={powerFactor}
              onChange={(e) => setPowerFactor(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Safety Margin (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              className={`${inputCls} w-28`}
              value={safetyMargin}
              onChange={(e) => setSafetyMargin(Number(e.target.value))}
            />
          </div>
          <button
            onClick={onCalculate}
            disabled={calc.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-sm transition-colors"
          >
            <Zap className="h-4 w-4" />
            {calc.isPending ? "Calculating..." : "Calculate"}
          </button>
        </div>
      </div>

      {result && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Recommended Generator</p>
              <p className="text-4xl font-bold text-primary">
                {result.recommendedStandardKva} <span className="text-2xl">kVA</span>
              </p>
              <p className="mt-1 text-sm text-foreground">{result.recommendation}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <Stat label="Running load" value={`${result.runningKva} kVA`} />
              <Stat label="Peak load" value={`${result.peakKva} kVA`} />
              <Stat label="Running watts" value={`${result.runningWatts.toLocaleString()} W`} />
              <Stat label="Peak watts" value={`${result.peakWatts.toLocaleString()} W`} />
            </div>
          </div>
          {result.surgeContributor && (
            <p className="mt-3 text-xs text-muted-foreground">
              Largest start-up surge from: <strong>{result.surgeContributor}</strong>.
            </p>
          )}

          {/* Calculate, then quote — the sizing carries straight into the document. */}
          <div className="mt-5 border-t border-primary/20 pt-4" data-testid="calc-to-quote">
            <p className="text-sm font-semibold text-foreground">Quote this sizing</p>
            {suggestions && suggestions.length > 0 ? (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  Catalog gensets rated for {result.recommendedStandardKva} kVA or above — the
                  description, price and GST come across with the pick.
                </p>
                <div className="mt-2 space-y-1.5">
                  {suggestions.map((s) => (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-sm transition ${
                        pickedId === s.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:bg-accent"
                      }`}
                    >
                      <input
                        type="radio"
                        name="genset"
                        className="h-4 w-4"
                        checked={pickedId === s.id}
                        onChange={() => setPickedId(s.id)}
                        data-testid={`pick-genset-${s.id}`}
                      />
                      {s.primaryImageUrl && (
                        <img
                          src={s.primaryImageUrl}
                          alt=""
                          className="h-9 w-9 rounded object-cover"
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                        {s.name}
                        {s.kva ? (
                          <span className="ml-2 text-xs text-muted-foreground">{s.kva} kVA</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatCurrency(s.price)}
                      </span>
                    </label>
                  ))}
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-sm transition ${
                      pickedId === null
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:bg-accent"
                    }`}
                  >
                    <input
                      type="radio"
                      name="genset"
                      className="h-4 w-4"
                      checked={pickedId === null}
                      onChange={() => setPickedId(null)}
                      data-testid="pick-genset-none"
                    />
                    <span className="text-foreground">
                      None of these — quote the calculated size with the working written out
                    </span>
                  </label>
                </div>
              </>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                No catalog genset is rated for {result.recommendedStandardKva} kVA yet, so the
                quotation starts from the calculated size and the load breakdown. Add the model to
                the Catalog to have its description and price come across automatically.
              </p>
            )}

            <button
              onClick={() => setQuoteOpen(true)}
              data-testid="calc-create-quotation"
              className="mt-3 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors"
            >
              <FileText className="h-4 w-4" /> Create Quotation
            </button>
          </div>
        </div>
      )}

      <QuotationDialog
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        mode="create"
        value={null}
        defaultDocType="quotation"
        prefill={quotePrefill}
        onSuccess={() => {
          setQuoteOpen(false);
          toast.success("Quotation created from the calculated load");
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold text-foreground">{value}</div>
    </div>
  );
}
