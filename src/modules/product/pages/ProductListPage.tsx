import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Download, Upload, ImageOff } from "lucide-react";
import { ResourceListPage } from "@/modules/common/ResourceListPage";
import { ProductDialog } from "../components/ProductDialog";
import { useProducts, useDeleteProduct, useProductFacets } from "../hooks/useProducts";
import { importProducts, productExportPath } from "../api/productApi";
import { downloadAuthenticatedFile } from "@/shared/lib/downloadFile";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import {
  PRODUCT_FUEL_LABELS,
  PRODUCT_FUEL_TYPES,
  PRODUCT_PHASE_LABELS,
} from "../constants/product.constants";
import { useAppSelector } from "@/app/hooks";
import { formatCurrency } from "@/lib/utils";
import type { Product, ProductListQuery, ProductFuelType } from "../types";

const filterSelectCls =
  "rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";
const filterInputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";

/** Tags are stored lower-cased; show them title-cased. */
function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ProductListPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const canManage = role === "admin" || role === "manager" || role === "inventory";
  const canDelete = role === "admin";

  const [fuelType, setFuelType] = useState<ProductFuelType | "">("");
  const [category, setCategory] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { data: facets } = useProductFacets();

  async function onExport() {
    try {
      await downloadAuthenticatedFile(productExportPath, "catalog.xlsx");
      toast.success("Catalog exported");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const result = await importProducts(base64);
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(
        `Imported ${result.created} of ${result.total} rows${
          result.skipped ? `, ${result.skipped} skipped` : ""
        }`,
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <>
      {canManage && (
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFileChosen}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Upload className="h-4 w-4" /> Import Excel
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Download className="h-4 w-4" /> Export Excel
          </button>
        </div>
      )}

      <ResourceListPage<Product, ProductListQuery>
        title="Product Catalog"
        subtitle="Descriptions, specs and images that feed quotations"
        newButtonText="New Product"
        searchPlaceholder="Search by name, brand or model..."
        minTableWidth="min-w-[1200px]"
        emptyText="No catalog products yet. Add one, or import a spreadsheet."
        deleteConfirmText="Remove this product from the catalog? Existing quotations keep their copy."
        hideCreateButton={!canManage}
        columns={[
          {
            header: "Product",
            getValue: (p) => (
              <div className="flex items-center gap-2.5">
                {p.primaryImageUrl ? (
                  <img
                    src={p.primaryImageUrl}
                    alt={p.name}
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border bg-muted/40">
                    <ImageOff className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground" title={p.name}>
                    {p.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[p.brand, p.modelCode].filter(Boolean).join(" · ") || "-"}
                  </div>
                </div>
              </div>
            ),
          },
          { header: "KVA", getValue: (p) => p.kva ?? "-", className: "font-mono" },
          { header: "Fuel", getValue: (p) => PRODUCT_FUEL_LABELS[p.fuelType] },
          { header: "Phase", getValue: (p) => PRODUCT_PHASE_LABELS[p.phase] },
          {
            header: "Price",
            getValue: (p) => (p.price ? formatCurrency(p.price) : "-"),
          },
          { header: "GST %", getValue: (p) => `${p.taxRate}%`, className: "font-mono" },
          {
            header: "Description",
            getValue: (p) => (
              <span
                className="block max-w-[260px] truncate text-xs text-muted-foreground"
                title={p.longDescription || p.shortDescription}
              >
                {p.longDescription || p.shortDescription || "—"}
              </span>
            ),
          },
          {
            header: "Specs",
            getValue: (p) => (p.specs.length ? `${p.specs.length}` : "-"),
            className: "font-mono",
          },
          { header: "Images", getValue: (p) => p.images.length || "-", className: "font-mono" },
          {
            header: "Status",
            getValue: (p) =>
              p.isActive ? (
                <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Active
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                  Inactive
                </span>
              ),
          },
        ]}
        useList={useProducts}
        useDelete={canDelete ? useDeleteProduct : undefined}
        buildQuery={({ search, page, limit }) => ({
          search: search || undefined,
          fuelType: fuelType || undefined,
          category: category || undefined,
          activeOnly: activeOnly || undefined,
          page,
          limit,
        })}
        renderFilters={({ search, setSearch }) => (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="min-w-[220px] flex-1">
              <label
                className="mb-1 block text-xs font-medium text-muted-foreground"
                htmlFor="product-search"
              >
                Search
              </label>
              <input
                id="product-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, brand or model..."
                className={filterInputCls}
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-medium text-muted-foreground"
                htmlFor="product-category-filter"
              >
                Category
              </label>
              <select
                id="product-category-filter"
                className={filterSelectCls}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All</option>
                {(facets?.categories ?? []).map((c) => (
                  <option key={c.category} value={c.category}>
                    {titleCase(c.category)} ({c.count})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-medium text-muted-foreground"
                htmlFor="product-fuel-filter"
              >
                Fuel
              </label>
              <select
                id="product-fuel-filter"
                className={filterSelectCls}
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value as ProductFuelType | "")}
              >
                <option value="">All</option>
                {PRODUCT_FUEL_TYPES.map((f) => (
                  <option key={f} value={f}>
                    {PRODUCT_FUEL_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              Active only
            </label>
          </div>
        )}
        renderActions={
          canManage
            ? (item, onEdit, onRequestDelete) => (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onEdit(item)}
                    className="flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => onRequestDelete(item.id)}
                      className="flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  )}
                </div>
              )
            : () => <span className="text-xs text-muted-foreground">View only</span>
        }
        renderDialog={
          canManage
            ? ({ open, onOpenChange, mode, value, onSuccess }) => (
                <ProductDialog
                  open={open}
                  onOpenChange={onOpenChange}
                  mode={mode}
                  value={value}
                  onSuccess={onSuccess}
                />
              )
            : undefined
        }
      />
    </>
  );
}
