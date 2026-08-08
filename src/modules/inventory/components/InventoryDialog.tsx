import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormDialog } from "@/modules/common/FormDialog";
import { inventorySchema, type InventoryFormValues } from "../validations/inventory.validation";
import { useCreateInventory, useUpdateInventory } from "../hooks/useInventory";
import { FUEL_TYPES, PHASES, FUEL_LABELS, PHASE_LABELS } from "../constants/inventory.constants";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import type { Inventory } from "../types";

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";

function Field({
  label,
  error,
  children,
  span2,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? "sm:col-span-2" : undefined}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  value: Inventory | null;
  onSuccess: () => void;
}

export function InventoryDialog({ open, onOpenChange, mode, value, onSuccess }: Props) {
  const createMutation = useCreateInventory();
  const updateMutation = useUpdateInventory();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<InventoryFormValues>({
    resolver: zodResolver(inventorySchema),
    defaultValues: { fuelType: "diesel", phase: "three", lowStockThreshold: 2 },
  });
  const { errors } = form.formState;

  useEffect(() => {
    if (open) {
      form.reset(
        mode === "edit" && value
          ? {
              model: value.model,
              brand: value.brand ?? "",
              kva: value.kva,
              fuelType: value.fuelType,
              phase: value.phase,
              location: value.location ?? "",
              availableQuantity: value.availableQuantity,
              lowStockThreshold: value.lowStockThreshold,
              purchasePrice: value.purchasePrice,
              sellingPrice: value.sellingPrice,
              purchaseDate: value.purchaseDate ? value.purchaseDate.substring(0, 10) : "",
              hsnCode: value.hsnCode ?? "",
              notes: value.notes ?? "",
            }
          : {
              model: "",
              brand: "",
              kva: 0,
              fuelType: "diesel",
              phase: "three",
              location: "",
              availableQuantity: 0,
              lowStockThreshold: 2,
              purchasePrice: 0,
              sellingPrice: 0,
              purchaseDate: "",
              hsnCode: "8502",
              notes: "",
            },
      );
    }
  }, [open, mode, value, form]);

  async function onSubmit(data: InventoryFormValues) {
    try {
      const payload = { ...data, purchaseDate: data.purchaseDate || undefined };
      // availableQuantity is only set on create — restock uses Add Stock.
      if (mode === "edit") delete (payload as { availableQuantity?: number }).availableQuantity;
      if (mode === "create") {
        await createMutation.mutateAsync(payload);
      } else if (value) {
        await updateMutation.mutateAsync({ id: value.id, payload });
      }
      toast.success(mode === "create" ? "Inventory item created" : "Inventory item updated");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "New Generator Model" : "Edit Generator Model"}
      onSubmit={form.handleSubmit(onSubmit)}
      isPending={isPending}
      size="lg"
      submitLabel={mode === "create" ? "Add to Inventory" : "Save Changes"}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Model *" error={errors.model?.message}>
          <input
            className={inputCls}
            placeholder="e.g. Cummins C62D5"
            {...form.register("model")}
          />
        </Field>
        <Field label="Brand" error={errors.brand?.message}>
          <input
            className={inputCls}
            placeholder="Cummins / Kirloskar / Mahindra"
            {...form.register("brand")}
          />
        </Field>
        <Field label="KVA *" error={errors.kva?.message}>
          <input type="number" step="0.5" className={inputCls} {...form.register("kva")} />
        </Field>
        <Field label="Fuel Type">
          <select className={inputCls} {...form.register("fuelType")}>
            {FUEL_TYPES.map((f) => (
              <option key={f} value={f}>
                {FUEL_LABELS[f]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Phase">
          <select className={inputCls} {...form.register("phase")}>
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {PHASE_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Location" error={errors.location?.message}>
          <input
            className={inputCls}
            placeholder="Branch / godown, e.g. Mumbai Yard"
            {...form.register("location")}
          />
        </Field>
        {mode === "create" && (
          <Field label="Opening Stock Qty" error={errors.availableQuantity?.message}>
            <input type="number" className={inputCls} {...form.register("availableQuantity")} />
          </Field>
        )}
        <Field label="Low-stock Alert At" error={errors.lowStockThreshold?.message}>
          <input type="number" className={inputCls} {...form.register("lowStockThreshold")} />
        </Field>
        <Field label="Purchase Price (₹/unit)">
          <input type="number" className={inputCls} {...form.register("purchasePrice")} />
        </Field>
        <Field label="Selling Price (₹/unit)">
          <input type="number" className={inputCls} {...form.register("sellingPrice")} />
        </Field>
        <Field label="Purchase Date">
          <input type="date" className={inputCls} {...form.register("purchaseDate")} />
        </Field>
        <Field label="HSN Code">
          <input className={inputCls} {...form.register("hsnCode")} />
        </Field>
        <Field label="Notes" span2>
          <input className={inputCls} {...form.register("notes")} />
        </Field>
      </div>
    </FormDialog>
  );
}
