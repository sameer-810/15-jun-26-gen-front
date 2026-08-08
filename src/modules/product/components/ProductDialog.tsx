import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, ImagePlus, X } from "lucide-react";
import { FormDialog } from "@/modules/common/FormDialog";
import { MediaPickerDialog } from "@/modules/media/components/MediaPickerDialog";
import { productSchema, type ProductFormValues } from "../validations/product.validation";
import { useCreateProduct, useUpdateProduct } from "../hooks/useProducts";
import { DEFAULT_SPEC_LABELS } from "../constants/product.constants";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import type { Media } from "@/modules/media/types";
import type { Product } from "../types";

const inputCls =
  "w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";

function Field({
  label,
  error,
  children,
  span2,
  hint,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  span2?: boolean;
  hint?: string;
}) {
  return (
    <div className={span2 ? "sm:col-span-2" : undefined}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  value: Product | null;
  onSuccess: () => void;
}

export function ProductDialog({ open, onOpenChange, mode, value, onSuccess }: Props) {
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const isPending = createMutation.isPending || updateMutation.isPending;

  // Images are managed outside the form — they come from the media picker,
  // not from typed input.
  const [images, setImages] = useState<Media[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      fuelType: "diesel",
      phase: "three",
      price: 0,
      taxRate: 18,
      specs: [],
      isActive: true,
    },
  });
  const { errors } = form.formState;
  const specs = useFieldArray({ control: form.control, name: "specs" });

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && value) {
      form.reset({
        name: value.name,
        brand: value.brand ?? "",
        modelCode: value.modelCode ?? "",
        kva: value.kva,
        fuelType: value.fuelType,
        phase: value.phase,
        hsnCode: value.hsnCode ?? "8502",
        unit: value.unit ?? "Piece",
        price: value.price,
        taxRate: value.taxRate,
        shortDescription: value.shortDescription ?? "",
        longDescription: value.longDescription ?? "",
        specs: value.specs ?? [],
        categoriesText: (value.categories ?? []).join(", "),
        isActive: value.isActive,
      });
      setImages(value.images ?? []);
    } else {
      form.reset({
        name: "",
        brand: "",
        modelCode: "",
        kva: undefined,
        fuelType: "diesel",
        phase: "three",
        hsnCode: "8502",
        unit: "Piece",
        price: 0,
        taxRate: 18,
        shortDescription: "",
        longDescription: "",
        // Seed the spec labels the client's sample quotation uses, so the
        // data-entry team fills the right shape rather than inventing one.
        specs: DEFAULT_SPEC_LABELS.map((label) => ({ label, value: "" })),
        categoriesText: "",
        isActive: true,
      });
      setImages([]);
    }
  }, [open, mode, value, form]);

  async function onSubmit(data: ProductFormValues) {
    try {
      const payload = {
        ...data,
        kva: data.kva || undefined,
        // Blank spec rows are scaffolding, not data — drop them on save.
        specs: data.specs.filter((s) => s.label.trim() && s.value.trim()),
        categories: data.categoriesText || undefined,
        imageIds: images.map((m) => m.id),
      };
      delete (payload as { categoriesText?: string }).categoriesText;

      if (mode === "create") {
        await createMutation.mutateAsync(payload);
      } else if (value) {
        await updateMutation.mutateAsync({ id: value.id, payload });
      }
      toast.success(mode === "create" ? "Product added to catalog" : "Product updated");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={mode === "create" ? "New Catalog Product" : "Edit Catalog Product"}
        onSubmit={form.handleSubmit(onSubmit)}
        isPending={isPending}
        size="xl"
        submitLabel={mode === "create" ? "Add to Catalog" : "Save Changes"}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Product Name *" error={errors.name?.message} span2>
              <input
                className={inputCls}
                placeholder="e.g. 4 Kva BAJAJ M Non Silent Portable Generator Set"
                {...form.register("name")}
              />
            </Field>
            <Field label="Brand" error={errors.brand?.message}>
              <input
                className={inputCls}
                placeholder="Bajaj / Mahindra"
                {...form.register("brand")}
              />
            </Field>
            <Field label="Model Code" error={errors.modelCode?.message}>
              <input className={inputCls} placeholder="BM-4000" {...form.register("modelCode")} />
            </Field>
            <Field label="KVA" error={errors.kva?.message}>
              <input
                type="number"
                step="0.5"
                className={`${inputCls} no-spinner text-right tabular-nums`}
                {...form.register("kva")}
              />
            </Field>
            <Field label="Fuel Type">
              <select className={inputCls} {...form.register("fuelType")}>
                <option value="diesel">Diesel</option>
                <option value="gas">Gas</option>
                <option value="petrol">Petrol</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Phase">
              <select className={inputCls} {...form.register("phase")}>
                <option value="three">Three Phase</option>
                <option value="single">Single Phase</option>
              </select>
            </Field>
            <Field label="Unit">
              <input className={inputCls} placeholder="Piece" {...form.register("unit")} />
            </Field>
            <Field label="Price (₹)" error={errors.price?.message}>
              <input
                type="number"
                className={`${inputCls} no-spinner text-right tabular-nums`}
                {...form.register("price")}
              />
            </Field>
            <Field label="GST %" error={errors.taxRate?.message}>
              <input
                type="number"
                className={`${inputCls} no-spinner text-right tabular-nums`}
                {...form.register("taxRate")}
              />
            </Field>
            <Field label="HSN Code">
              <input className={inputCls} {...form.register("hsnCode")} />
            </Field>
            <Field
              label="Categories"
              hint="Comma-separated. Drives the catalog and file-picker filters."
            >
              <input
                className={inputCls}
                placeholder="Portable Generator, Petrol Generator"
                {...form.register("categoriesText")}
              />
            </Field>
          </div>

          <Field label="Short Description" hint="One line, shown in dropdowns and cards." span2>
            <input
              className={inputCls}
              placeholder="4 kVA petrol portable genset, self-start"
              {...form.register("shortDescription")}
            />
          </Field>

          <Field
            label="Full Description"
            error={errors.longDescription?.message}
            hint="This is what auto-fills the quotation line item. Line breaks are preserved."
          >
            <textarea
              rows={8}
              className={`${inputCls} font-mono text-[13px] leading-relaxed`}
              placeholder={
                "4 KVA Bajaj M Non-SILENT elite class portable Petrol Generator Set with latest technology, Air Cooled engine developing 7.5 BHP at 3000 RPM...\n\nSPECIAL FEATURES:\n1) Self start\n2) Key switch"
              }
              {...form.register("longDescription")}
            />
          </Field>

          {/* Spec block — reproduces the table in the sample quotation PDF. */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold text-muted-foreground">
                SPECIFICATIONS
                <span className="ml-2 font-normal normal-case text-muted-foreground">
                  (blank rows are ignored)
                </span>
              </div>
              <button
                type="button"
                onClick={() => specs.append({ label: "", value: "" })}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent"
              >
                <Plus className="h-3 w-3" /> Add spec
              </button>
            </div>
            <div className="space-y-2">
              {specs.fields.map((field, i) => (
                <div key={field.id}>
                  <div className="grid grid-cols-[1fr_1.4fr_32px] gap-2">
                    <input
                      className={inputCls}
                      placeholder="Label (e.g. Cooling System)"
                      aria-label={`Spec label ${i + 1}`}
                      {...form.register(`specs.${i}.label`)}
                    />
                    <input
                      className={inputCls}
                      placeholder="Value (e.g. Water Cooling)"
                      aria-label={`Spec value ${i + 1}`}
                      {...form.register(`specs.${i}.value`)}
                    />
                    <button
                      type="button"
                      onClick={() => specs.remove(i)}
                      aria-label={`Remove spec ${i + 1}`}
                      className="flex items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {errors.specs?.[i]?.label && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.specs[i]?.label?.message}
                    </p>
                  )}
                </div>
              ))}
              {specs.fields.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No specs yet. Add the rows you want printed under the description.
                </p>
              )}
            </div>
          </div>

          {/* Images from the media library */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold text-muted-foreground">
                IMAGES
                <span className="ml-2 font-normal normal-case text-muted-foreground">
                  (the first is the primary)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent"
              >
                <ImagePlus className="h-3 w-3" /> Choose images
              </button>
            </div>
            {images.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No images attached. These are used on the catalog card and, from Phase 3, in the
                quotation PDF.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2" data-testid="product-images">
                {images.map((m, i) => (
                  <div
                    key={m.id}
                    className="relative h-20 w-20 overflow-hidden rounded-lg border border-border"
                  >
                    <img
                      src={m.thumbnailUrl}
                      alt={m.filename}
                      className="h-full w-full object-cover"
                    />
                    {i === 0 && (
                      <span className="absolute bottom-0 left-0 right-0 bg-primary/80 text-center text-[9px] font-medium text-primary-foreground">
                        Primary
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((x) => x.id !== m.id))}
                      aria-label={`Remove ${m.filename}`}
                      className="absolute right-0 top-0 rounded-bl bg-black/60 p-0.5 text-white hover:bg-black/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              {...form.register("isActive")}
            />
            Active — show in the quotation product picker
          </label>
        </div>
      </FormDialog>

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={setImages}
        initialSelectedIds={images.map((m) => m.id)}
        restrictKind="image"
        title="Choose product images"
      />
    </>
  );
}
