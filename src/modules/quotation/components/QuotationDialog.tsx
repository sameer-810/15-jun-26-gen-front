import { useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { FormDialog } from "@/modules/common/FormDialog";
import { ProductPicker } from "@/modules/product/components/ProductPicker";
import { quotationSchema, type QuotationFormValues } from "../validations/quotation.validation";
import { useCreateQuotation, useUpdateQuotation, useCustomerLookup } from "../hooks/useQuotations";
import { DEFAULT_TERMS, DOC_TYPE_LABELS, DOC_TYPES } from "../constants/quotation.constants";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { formatCurrency } from "@/lib/utils";
import type { ProductOption } from "@/modules/product/types";
import type { DocType, Quotation, QuotationPrefill } from "../types";

const inputCls =
  "w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";
// Numeric cells: right-aligned so the significant digits stay visible, tabular
// figures so columns line up, and no native spinner (it stole ~16px of the box,
// which is what made rates look cut off).
const numCls = `${inputCls} no-spinner text-right tabular-nums`;

/**
 * Explicit track widths for the numeric part of a line-item row. Percentage /
 * `col-span` widths squeezed Rate and GST until a 5-digit price was clipped;
 * fixed pixel minimums guarantee every number is fully readable, and the row
 * scrolls horizontally rather than shrinking below them.
 *
 * Description is no longer one of these tracks — it is a full-width textarea
 * above them, because a catalog description runs to many lines (point 5).
 */
const ITEM_GRID = "grid gap-2 grid-cols-[minmax(140px,2fr)_72px_90px_70px_116px_80px_88px_32px]";

const blankItem = {
  description: "",
  model: "",
  kva: undefined,
  hsnCode: "8502",
  quantity: 1,
  unitPrice: 0,
  discountPct: 0,
  taxRate: 18,
  unit: "Piece",
  product: undefined,
  imageUrl: "",
  specs: [],
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  value: Quotation | null;
  defaultDocType: DocType;
  onSuccess: () => void;
  /** Seed a new document from another record (e.g. "Quote" on a lead row). */
  prefill?: QuotationPrefill | null;
}

export function QuotationDialog({
  open,
  onOpenChange,
  mode,
  value,
  defaultDocType,
  onSuccess,
  prefill,
}: Props) {
  const createMutation = useCreateQuotation();
  const updateMutation = useUpdateQuotation();
  const lookupMutation = useCustomerLookup();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      docType: defaultDocType,
      isInterState: false,
      shipToSameAsBilling: true,
      items: [{ ...blankItem }],
      termsText: DEFAULT_TERMS.join("\n"),
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const { errors } = form.formState;

  useEffect(() => {
    if (open) {
      if (mode === "edit" && value) {
        form.reset({
          docType: value.docType,
          date: value.date ? value.date.substring(0, 10) : "",
          validUntil: value.validUntil ? value.validUntil.substring(0, 10) : "",
          customerName: value.customerName,
          customerMobile: value.customerMobile ?? "",
          customerEmail: value.customerEmail ?? "",
          customerAddress: value.customerAddress ?? "",
          customerGstin: value.customerGstin ?? "",
          customerState: value.customerState ?? "",
          shipToSameAsBilling: value.shipToSameAsBilling,
          shipToName: value.shipToName ?? "",
          shipToAddress: value.shipToAddress ?? "",
          shipToGstin: value.shipToGstin ?? "",
          shipToState: value.shipToState ?? "",
          shipToContactPerson: value.shipToContactPerson ?? "",
          shipToMobile: value.shipToMobile ?? "",
          isInterState: value.isInterState,
          items: value.items.map((it) => ({
            description: it.description,
            model: it.model ?? "",
            kva: it.kva,
            hsnCode: it.hsnCode ?? "8502",
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discountPct: it.discountPct ?? 0,
            taxRate: it.taxRate ?? 18,
            unit: it.unit ?? "Piece",
            product: it.productId ?? undefined,
            imageUrl: it.imageUrl ?? "",
            specs: it.specs ?? [],
          })),
          termsText: (value.terms ?? []).join("\n"),
          notes: value.notes ?? "",
        });
      } else {
        form.reset({
          docType: defaultDocType,
          date: "",
          validUntil: "",
          customerName: prefill?.customerName ?? "",
          customerMobile: prefill?.customerMobile ?? "",
          customerEmail: prefill?.customerEmail ?? "",
          customerAddress: prefill?.customerAddress ?? "",
          customerGstin: "",
          customerState: prefill?.customerState ?? "",
          shipToSameAsBilling: true,
          shipToName: "",
          shipToAddress: "",
          shipToGstin: "",
          shipToState: "",
          shipToContactPerson: "",
          shipToMobile: "",
          isInterState: false,
          items: [
            {
              ...blankItem,
              description: prefill?.description ?? "",
              kva: prefill?.kva,
              quantity: prefill?.quantity ?? 1,
              unitPrice: prefill?.unitPrice ?? 0,
            },
          ],
          termsText: DEFAULT_TERMS.join("\n"),
          notes: "",
        });
      }
    }
  }, [open, mode, value, defaultDocType, prefill, form]);

  // Live totals preview (backend recomputes authoritatively).
  const watchedItems = form.watch("items");
  const isInterState = form.watch("isInterState");
  // react-hook-form mutates the field-array in place and hands back the SAME
  // array reference on every render, so keying the memo on the reference alone
  // computed zeros once and never recomputed — the preview sat at ₹0.00 no
  // matter what was typed. Key on the serialised values instead.
  const itemsKey = JSON.stringify(watchedItems);
  const totals = useMemo(() => {
    let taxable = 0;
    let tax = 0;
    (watchedItems || []).forEach((it) => {
      const gross = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
      const disc = (gross * (Number(it.discountPct) || 0)) / 100;
      const t = gross - disc;
      taxable += t;
      tax += (t * (Number(it.taxRate) || 0)) / 100;
    });
    const grand = Math.round(taxable + tax);
    return { taxable, tax, grand };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see itemsKey above
  }, [itemsKey]);

  /**
   * Apply a catalog product to line item `i` — Change Request point 4.
   * The field values come from the server (`quotationDefaults`) so the
   * auto-fill rule is defined once, next to the catalog data.
   * shouldDirty/shouldValidate keep the totals preview and validation in step.
   */
  function applyProduct(i: number, option: ProductOption) {
    const d = option.quotationDefaults;
    const opts = { shouldDirty: true, shouldValidate: true } as const;
    form.setValue(`items.${i}.description`, d.description, opts);
    form.setValue(`items.${i}.model`, d.model, opts);
    if (d.kva !== undefined && d.kva !== null) form.setValue(`items.${i}.kva`, d.kva, opts);
    form.setValue(`items.${i}.hsnCode`, d.hsnCode, opts);
    form.setValue(`items.${i}.unitPrice`, d.unitPrice, opts);
    form.setValue(`items.${i}.taxRate`, d.taxRate, opts);
    // Snapshot the catalog identity, image and unit so the PDF can print the
    // picture and spec block for this line (points 15 & 16).
    form.setValue(`items.${i}.product`, option.id, opts);
    form.setValue(`items.${i}.unit`, option.unit ?? "Piece", opts);
    form.setValue(`items.${i}.imageUrl`, option.primaryImageUrl ?? "", opts);
    form.setValue(`items.${i}.specs`, option.specs ?? [], opts);
  }

  /** Pull the last billing/shipping block used for this customer (point 6). */
  async function autoFetchCustomer() {
    const mobile = form.getValues("customerMobile");
    const name = form.getValues("customerName");
    if (!mobile?.trim() && !name?.trim()) {
      toast.error("Enter a mobile number or customer name first");
      return;
    }
    try {
      const found = await lookupMutation.mutateAsync({
        mobile: mobile?.trim() || undefined,
        name: name?.trim() || undefined,
      });
      if (!found) {
        toast.error("No earlier document found for this customer");
        return;
      }
      const opts = { shouldDirty: true, shouldValidate: true } as const;
      form.setValue("customerName", found.customerName, opts);
      form.setValue("customerMobile", found.customerMobile ?? "", opts);
      form.setValue("customerEmail", found.customerEmail ?? "", opts);
      form.setValue("customerAddress", found.customerAddress ?? "", opts);
      form.setValue("customerGstin", found.customerGstin ?? "", opts);
      form.setValue("customerState", found.customerState ?? "", opts);
      form.setValue("isInterState", found.isInterState, opts);
      form.setValue("shipToSameAsBilling", found.shipToSameAsBilling, opts);
      form.setValue("shipToName", found.shipToName ?? "", opts);
      form.setValue("shipToAddress", found.shipToAddress ?? "", opts);
      form.setValue("shipToGstin", found.shipToGstin ?? "", opts);
      form.setValue("shipToState", found.shipToState ?? "", opts);
      form.setValue("shipToContactPerson", found.shipToContactPerson ?? "", opts);
      form.setValue("shipToMobile", found.shipToMobile ?? "", opts);
      toast.success(`Filled from ${found.sourceDocNumber}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function onSubmit(data: QuotationFormValues) {
    try {
      const terms = (data.termsText || "")
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean);
      const payload = {
        docType: data.docType,
        date: data.date || undefined,
        validUntil: data.validUntil || undefined,
        customerName: data.customerName,
        customerMobile: data.customerMobile || undefined,
        customerEmail: data.customerEmail || undefined,
        customerAddress: data.customerAddress || undefined,
        customerGstin: data.customerGstin || undefined,
        customerState: data.customerState || undefined,
        shipToSameAsBilling: data.shipToSameAsBilling,
        // Only send the ship-to block when it is actually in use, so a
        // "same as billing" document doesn't carry stale text.
        ...(data.shipToSameAsBilling
          ? {}
          : {
              shipToName: data.shipToName || undefined,
              shipToAddress: data.shipToAddress || undefined,
              shipToGstin: data.shipToGstin || undefined,
              shipToState: data.shipToState || undefined,
              shipToContactPerson: data.shipToContactPerson || undefined,
              shipToMobile: data.shipToMobile || undefined,
            }),
        isInterState: data.isInterState,
        items: data.items.map((it) => ({
          description: it.description,
          model: it.model || undefined,
          kva: it.kva || undefined,
          hsnCode: it.hsnCode || undefined,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discountPct: Number(it.discountPct) || 0,
          taxRate: Number(it.taxRate),
          unit: it.unit || undefined,
          product: it.product || undefined,
          imageUrl: it.imageUrl || undefined,
          specs: it.specs?.length ? it.specs : undefined,
        })),
        terms,
        notes: data.notes || undefined,
      };
      if (mode === "create") {
        await createMutation.mutateAsync(payload);
      } else if (value) {
        await updateMutation.mutateAsync({ id: value.id, payload });
      }
      toast.success(mode === "create" ? "Document created" : "Document updated");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  const docType = form.watch("docType");
  const shipToSameAsBilling = form.watch("shipToSameAsBilling");

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "New Document" : `Edit ${value?.docNumberFormatted ?? "Document"}`}
      onSubmit={form.handleSubmit(onSubmit)}
      isPending={isPending}
      size="xl"
      submitLabel={mode === "create" ? "Create" : "Save Changes"}
    >
      <div className="space-y-5">
        {/* Doc type + dates */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
            <select
              className={inputCls}
              {...form.register("docType")}
              disabled={mode === "edit"}
              aria-label="Document type"
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DOC_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
            <input type="date" className={inputCls} {...form.register("date")} />
          </div>
          {docType === "quotation" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Valid Until
              </label>
              <input type="date" className={inputCls} {...form.register("validUntil")} />
            </div>
          )}
          <label className="flex items-end gap-2 text-sm text-foreground pb-1.5">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              {...form.register("isInterState")}
            />
            Inter-state (IGST)
          </label>
        </div>

        {/* Bill To */}
        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-muted-foreground">BILL TO</div>
            {/* Point 6 "auto fetch" — pull this customer's last billing and
                shipping block instead of re-keying a repeat order. */}
            <button
              type="button"
              onClick={autoFetchCustomer}
              disabled={lookupMutation.isPending}
              data-testid="auto-fetch-customer"
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${lookupMutation.isPending ? "animate-spin" : ""}`} />
              Auto-fetch from last document
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <input
                className={inputCls}
                placeholder="Customer name *"
                {...form.register("customerName")}
              />
              {errors.customerName && (
                <p className="mt-1 text-xs text-destructive">{errors.customerName.message}</p>
              )}
            </div>
            <input className={inputCls} placeholder="Mobile" {...form.register("customerMobile")} />
            <input className={inputCls} placeholder="Email" {...form.register("customerEmail")} />
            <input className={inputCls} placeholder="GSTIN" {...form.register("customerGstin")} />
            <input className={inputCls} placeholder="State" {...form.register("customerState")} />
            <input
              className={inputCls}
              placeholder="Address"
              {...form.register("customerAddress")}
            />
          </div>
        </div>

        {/* Ship To — the R4 sample invoice splits delivery from billing. */}
        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-muted-foreground">SHIP TO</div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                data-testid="ship-to-same"
                {...form.register("shipToSameAsBilling")}
              />
              Same as billing
            </label>
          </div>
          {shipToSameAsBilling ? (
            <p className="text-xs text-muted-foreground">
              The document will repeat the Bill To block as the delivery address.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                className={inputCls}
                placeholder="Ship-to name"
                {...form.register("shipToName")}
              />
              <input
                className={inputCls}
                placeholder="Contact person"
                {...form.register("shipToContactPerson")}
              />
              <input
                className={inputCls}
                placeholder="Contact mobile"
                {...form.register("shipToMobile")}
              />
              <input
                className={inputCls}
                placeholder="Ship-to GSTIN"
                {...form.register("shipToGstin")}
              />
              <input
                className={inputCls}
                placeholder="Ship-to state"
                {...form.register("shipToState")}
              />
              <input
                className={inputCls}
                placeholder="Delivery address"
                {...form.register("shipToAddress")}
              />
            </div>
          )}
        </div>

        {/* Line items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-muted-foreground">LINE ITEMS</div>
            <button
              type="button"
              onClick={() => append({ ...blankItem })}
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors"
            >
              <Plus className="h-3 w-3" /> Add item
            </button>
          </div>
          <div className="space-y-2">
            {fields.map((field, i) => (
              <div key={field.id} className="rounded-lg border border-border p-2">
                {/* Catalog picker + description. Choosing a product fills the
                    description, model, KVA, HSN, rate and GST in one go
                    (Change Request points 4 + 5); free text still works. */}
                <div className="mb-2 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <label
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                      htmlFor={`item-description-${i}`}
                    >
                      Description
                    </label>
                    <textarea
                      id={`item-description-${i}`}
                      rows={2}
                      className={`${inputCls} resize-y leading-relaxed`}
                      placeholder="Description *"
                      {...form.register(`items.${i}.description`)}
                    />
                  </div>
                  <div className="w-44 shrink-0 pt-[22px]">
                    <ProductPicker
                      data-testid={`product-picker-${i}`}
                      onSelect={(option) => applyProduct(i, option)}
                    />
                  </div>
                </div>

                {/* Numeric columns — scroll as a unit so they never shrink
                    below a readable width. */}
                <div className="overflow-x-auto pb-1">
                  <div className="min-w-[740px]">
                    <div
                      className={`${ITEM_GRID} mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}
                    >
                      <div>Model</div>
                      <div className="text-right">KVA</div>
                      <div>HSN</div>
                      <div className="text-right">Qty</div>
                      <div className="text-right">Rate (₹)</div>
                      <div className="text-right">Disc %</div>
                      <div className="text-right">GST %</div>
                      <div />
                    </div>
                    <div className={ITEM_GRID}>
                      <input
                        className={inputCls}
                        placeholder="Model"
                        {...form.register(`items.${i}.model`)}
                      />
                      <input
                        type="number"
                        step="0.5"
                        className={numCls}
                        placeholder="KVA"
                        {...form.register(`items.${i}.kva`)}
                      />
                      <input
                        className={inputCls}
                        placeholder="HSN"
                        {...form.register(`items.${i}.hsnCode`)}
                      />
                      <input
                        type="number"
                        className={numCls}
                        placeholder="Qty"
                        {...form.register(`items.${i}.quantity`)}
                      />
                      <input
                        type="number"
                        className={numCls}
                        placeholder="Rate"
                        {...form.register(`items.${i}.unitPrice`)}
                      />
                      <input
                        type="number"
                        className={numCls}
                        placeholder="Disc%"
                        {...form.register(`items.${i}.discountPct`)}
                      />
                      <input
                        type="number"
                        className={numCls}
                        placeholder="GST%"
                        {...form.register(`items.${i}.taxRate`)}
                      />
                      <div className="flex items-center justify-center">
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(i)}
                            className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {errors.items?.[i]?.description && (
                  <p className="mt-1 text-xs text-destructive">Description is required</p>
                )}
              </div>
            ))}
          </div>
          {errors.items?.message && (
            <p className="mt-1 text-xs text-destructive">{errors.items.message}</p>
          )}
        </div>

        {/* Totals preview */}
        <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <span className="text-muted-foreground">
            Taxable: <strong className="text-foreground">{formatCurrency(totals.taxable)}</strong>
          </span>
          <span className="text-muted-foreground">
            {isInterState ? "IGST" : "GST"}:{" "}
            <strong className="text-foreground">{formatCurrency(totals.tax)}</strong>
          </span>
          <span className="text-base">
            Grand Total: <strong className="text-primary">{formatCurrency(totals.grand)}</strong>
          </span>
        </div>

        {/* Terms + notes */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Terms &amp; Conditions (one per line)
            </label>
            <textarea className={inputCls} rows={4} {...form.register("termsText")} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
            <textarea className={inputCls} rows={4} {...form.register("notes")} />
          </div>
        </div>
      </div>
    </FormDialog>
  );
}
