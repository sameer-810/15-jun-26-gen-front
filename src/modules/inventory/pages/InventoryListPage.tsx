import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, PackagePlus, Download, Upload, Trash2 } from "lucide-react";
import { ResourceListPage } from "@/modules/common/ResourceListPage";
import { RecordCard, CardAction } from "@/shared/components/RecordCard";
import { LocationSelect } from "@/modules/location/LocationSelect";
import { InventoryDialog } from "../components/InventoryDialog";
import { AddStockDialog } from "../components/AddStockDialog";
import { useInventory, useDeleteInventory } from "../hooks/useInventory";
import { importInventory, inventoryExportPath } from "../api/inventoryApi";
import { downloadAuthenticatedFile } from "@/shared/lib/downloadFile";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import {
  FUEL_LABELS,
  PHASE_LABELS,
  STOCK_STATUS_LABELS,
  STOCK_STATUS_COLORS,
  FUEL_TYPES,
} from "../constants/inventory.constants";
import { useAppSelector } from "@/app/hooks";
import { formatCurrency } from "@/lib/utils";
import type { Inventory, InventoryListQuery, FuelType } from "../types";

const filterSelectCls =
  "w-full md:w-auto rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";
const filterInputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";

/** Blank quantity boxes must mean "no filter", not 0. */
function toQty(v: string): number | undefined {
  const n = Number(v);
  return v.trim() === "" || Number.isNaN(n) ? undefined : n;
}

export function InventoryListPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const canManage = role === "admin" || role === "inventory";
  const canDelete = role === "admin";

  const [fuelType, setFuelType] = useState<FuelType | "">("");
  const [lowOnly, setLowOnly] = useState(false);
  const [location, setLocation] = useState("");
  const [minQty, setMinQty] = useState("");
  const [maxQty, setMaxQty] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [stockItem, setStockItem] = useState<Inventory | null>(null);
  const [stockOpen, setStockOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  async function onExport() {
    try {
      await downloadAuthenticatedFile(inventoryExportPath, "inventory.xlsx");
      toast.success("Inventory exported");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  function onImportClick() {
    fileRef.current?.click();
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    try {
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const result = await importInventory(base64);
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(
        `Imported ${result.created} of ${result.total} rows${result.skipped ? `, ${result.skipped} skipped` : ""}`,
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  // Search excluded — it keeps its own always-visible box on mobile.
  const activeFilterCount = [
    fuelType,
    lowOnly,
    location.trim(),
    minQty,
    maxQty,
    startDate,
    endDate,
  ].filter(Boolean).length;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={onFileChosen}
        className="hidden"
        aria-label="Import inventory from a spreadsheet"
      />
      <ResourceListPage<Inventory, InventoryListQuery>
        activeFilterCount={activeFilterCount}
        headerActions={
          canManage ? (
            <>
              <button
                onClick={onImportClick}
                aria-label="Import Excel"
                title="Import Excel"
                className="pg-tap flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-sm font-medium transition-colors hover:bg-accent md:min-h-0 md:min-w-0 md:px-3 md:py-2"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden md:inline">Import Excel</span>
              </button>
              <button
                onClick={onExport}
                aria-label="Export Excel"
                title="Export Excel"
                className="pg-tap flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-sm font-medium transition-colors hover:bg-accent md:min-h-0 md:min-w-0 md:px-3 md:py-2"
              >
                <Download className="h-4 w-4" />
                <span className="hidden md:inline">Export Excel</span>
              </button>
            </>
          ) : undefined
        }
        title="Inventory"
        subtitle="Generator models in stock"
        newButtonText="New Model"
        searchPlaceholder="Search by model or brand..."
        minTableWidth="min-w-[1200px]"
        rowOpensEditor
        emptyText="No inventory yet. Add your first generator model."
        deleteConfirmText="Delete this model from inventory? Sale history is retained."
        hideCreateButton={!canManage}
        columns={[
          {
            header: "Model",
            getValue: (i) => (
              <div>
                <div className="font-medium text-foreground">{i.model}</div>
                <div className="text-xs text-muted-foreground">{i.brand || "-"}</div>
              </div>
            ),
          },
          { header: "KVA", getValue: (i) => i.kva, className: "font-mono font-semibold" },
          { header: "Fuel", getValue: (i) => FUEL_LABELS[i.fuelType] },
          { header: "Phase", getValue: (i) => PHASE_LABELS[i.phase] },
          { header: "Location", getValue: (i) => i.location || "-" },
          {
            header: "Available",
            getValue: (i) => <span className="font-semibold">{i.availableQuantity}</span>,
          },
          { header: "Sold", getValue: (i) => i.soldQuantity },
          {
            header: "Selling ₹",
            getValue: (i) => (i.sellingPrice ? formatCurrency(i.sellingPrice) : "-"),
          },
          {
            header: "Status",
            getValue: (i) => (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STOCK_STATUS_COLORS[i.stockStatus]}`}
              >
                {STOCK_STATUS_LABELS[i.stockStatus]}
              </span>
            ),
          },
        ]}
        useList={useInventory}
        useDelete={canDelete ? useDeleteInventory : undefined}
        buildQuery={({ search, page, limit }) => ({
          search: search || undefined,
          fuelType: fuelType || undefined,
          lowStock: lowOnly || undefined,
          location: location.trim() || undefined,
          minQuantity: toQty(minQty),
          maxQuantity: toQty(maxQty),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page,
          limit,
        })}
        renderFilters={({ search, setSearch, layout }) => (
          /* `rounded-xl … shadow-sm` was an in-page panel claiming elevation it
             has not earned — `pg-tile` is the house primitive. See DESIGN.md. */
          <div
            className={layout === "sheet" ? "space-y-4" : "pg-tile flex flex-wrap items-end gap-3"}
          >
            {layout === "inline" && (
              <div className="flex-1 min-w-[220px]">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Search
                </label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Model or brand..."
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
                />
              </div>
            )}
            <div className="md:min-w-[150px]">
              <label
                className="block text-xs font-medium text-muted-foreground mb-1"
                htmlFor="inventory-location-filter"
              >
                Location
              </label>
              <LocationSelect
                id="inventory-location-filter"
                data-testid="inventory-location-filter"
                allowAll
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
                  aria-label="Minimum available quantity"
                  type="number"
                  min={0}
                  value={minQty}
                  onChange={(e) => setMinQty(e.target.value)}
                  placeholder="Min"
                  className={`${filterInputCls} no-spinner flex-1 text-right tabular-nums md:w-20 md:flex-none`}
                />
                <span className="text-muted-foreground">–</span>
                <input
                  aria-label="Maximum available quantity"
                  type="number"
                  min={0}
                  value={maxQty}
                  onChange={(e) => setMaxQty(e.target.value)}
                  placeholder="Max"
                  className={`${filterInputCls} no-spinner flex-1 text-right tabular-nums md:w-20 md:flex-none`}
                />
              </div>
            </div>
            {/* Same date window as Leads and Sales — point 9. */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Added between
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  aria-label="Added from"
                  data-testid="inventory-start-date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`${filterInputCls} min-w-0 flex-1 md:w-[140px] md:flex-none`}
                />
                <span className="text-muted-foreground">–</span>
                <input
                  type="date"
                  aria-label="Added to"
                  data-testid="inventory-end-date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`${filterInputCls} min-w-0 flex-1 md:w-[140px] md:flex-none`}
                />
              </div>
            </div>
            <div>
              <label
                className="block text-xs font-medium text-muted-foreground mb-1"
                htmlFor="inventory-fuel-filter"
              >
                Fuel
              </label>
              <select
                id="inventory-fuel-filter"
                className={filterSelectCls}
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value as FuelType | "")}
              >
                <option value="">All</option>
                {FUEL_TYPES.map((f) => (
                  <option key={f} value={f}>
                    {FUEL_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
            <label className="pg-tap flex items-center gap-2 text-sm text-foreground md:min-h-0 md:pb-2">
              <input
                type="checkbox"
                checked={lowOnly}
                onChange={(e) => setLowOnly(e.target.checked)}
                className="h-5 w-5 rounded border-input accent-primary md:h-4 md:w-4"
              />
              Low stock only
            </label>
          </div>
        )}
        renderActions={
          canManage
            ? (item, onEdit, onRequestDelete) => (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onEdit(item)}
                    className="flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    onClick={() => {
                      setStockItem(item);
                      setStockOpen(true);
                    }}
                    className="flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                  >
                    <PackagePlus className="h-3 w-3" /> Stock
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => onRequestDelete(item.id)}
                      className="flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  )}
                </div>
              )
            : () => <span className="text-xs text-muted-foreground">View only</span>
        }
        /*
          Stock as a card. Availability is the figure this screen exists to
          answer, so it takes the amount slot; price sits in the meta line, and
          "sold" drops off entirely — it is a reporting number, not something
          checked from a warehouse floor.
        */
        renderMobileCard={(i, { onEdit }) => (
          <RecordCard
            onClick={canManage ? () => onEdit(i) : undefined}
            title={i.model}
            amount={
              <span className={i.availableQuantity === 0 ? "text-destructive" : undefined}>
                {i.availableQuantity} left
              </span>
            }
            meta={[
              i.brand,
              `${i.kva} kVA`,
              FUEL_LABELS[i.fuelType],
              PHASE_LABELS[i.phase],
              i.location,
              i.sellingPrice ? formatCurrency(i.sellingPrice) : null,
            ]}
            badge={
              <span
                className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STOCK_STATUS_COLORS[i.stockStatus]}`}
              >
                {STOCK_STATUS_LABELS[i.stockStatus]}
              </span>
            }
            actions={
              canManage ? (
                <>
                  <CardAction icon={Pencil} label="Edit" onClick={() => onEdit(i)} />
                  <CardAction
                    icon={PackagePlus}
                    label="Add stock"
                    onClick={() => {
                      setStockItem(i);
                      setStockOpen(true);
                    }}
                  />
                </>
              ) : undefined
            }
          />
        )}
        hideActionsColumn={false}
        renderDialog={
          canManage
            ? ({ open, onOpenChange, mode, value, onSuccess }) => (
                <InventoryDialog
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

      <AddStockDialog
        open={stockOpen}
        onOpenChange={setStockOpen}
        item={stockItem}
        onSuccess={() => undefined}
      />
    </>
  );
}
