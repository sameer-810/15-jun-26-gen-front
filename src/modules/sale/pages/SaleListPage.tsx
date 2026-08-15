import { useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useSales, useDeleteSale } from "../hooks/useSales";
import { SaleDialog } from "../components/SaleDialog";
import { useAppSelector } from "@/app/hooks";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { PageLoader } from "@/shared/components/PageLoader";
import { LocationSelect } from "@/modules/location/LocationSelect";

const filterInputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";

/** Blank quantity boxes must mean "no filter", not 0. */
function toQty(v: string): number | undefined {
  const n = Number(v);
  return v.trim() === "" || Number.isNaN(n) ? undefined : n;
}

export function SaleListPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const canRecord = role === "admin" || role === "sales" || role === "inventory";
  const canDelete = role === "admin";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [minQty, setMinQty] = useState("");
  const [maxQty, setMaxQty] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data, isLoading, refetch } = useSales({
    search: search || undefined,
    location: location.trim() || undefined,
    minQuantity: toQty(minQty),
    maxQuantity: toQty(maxQty),
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    limit: 50,
  });
  const deleteMutation = useDeleteSale();
  const sales = data?.items ?? [];
  const total = data?.meta.total ?? 0;
  const monthValue = sales.reduce((s, x) => s + x.totalAmount, 0);

  async function onDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Sale voided; stock restored");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
    setConfirmDelete(null);
  }

  return (
    <div className="erp-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Sales</h1>
          <p className="text-sm text-muted-foreground">
            Completed generator sales · {total} records · page value {formatCurrency(monthValue)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          {canRecord && (
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" /> Record Sale
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label
            className="block text-xs font-medium text-muted-foreground mb-1"
            htmlFor="sale-search"
          >
            Search
          </label>
          <input
            id="sale-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Customer or model..."
            className={filterInputCls}
          />
        </div>
        <div className="min-w-[150px]">
          <label
            className="block text-xs font-medium text-muted-foreground mb-1"
            htmlFor="sale-location-filter"
          >
            Location
          </label>
          <LocationSelect
            id="sale-location-filter"
            data-testid="sale-location-filter"
            allowAll
            value={location}
            onChange={(v) => {
              setLocation(v);
              setPage(1);
            }}
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
              onChange={(e) => {
                setMinQty(e.target.value);
                setPage(1);
              }}
              placeholder="Min"
              className={`${filterInputCls} no-spinner w-20 text-right tabular-nums`}
            />
            <span className="text-muted-foreground">–</span>
            <input
              aria-label="Maximum quantity"
              type="number"
              min={1}
              value={maxQty}
              onChange={(e) => {
                setMaxQty(e.target.value);
                setPage(1);
              }}
              placeholder="Max"
              className={`${filterInputCls} no-spinner w-20 text-right tabular-nums`}
            />
          </div>
        </div>
        {/* Same date window as Leads — point 9 asks for it on every screen. */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Sold between
          </label>
          <div className="flex items-center gap-1">
            <input
              type="date"
              aria-label="Sold from"
              data-testid="sale-start-date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className={`${filterInputCls} w-[140px]`}
            />
            <span className="text-muted-foreground">–</span>
            <input
              type="date"
              aria-label="Sold to"
              data-testid="sale-end-date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className={`${filterInputCls} w-[140px]`}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        // This page predates the shared ResourceListPage, so it carried the old
        // table styling. Brought in line with every other list: pinned header,
        // no elevation on an in-page panel, actions last. Numeric columns are
        // right-aligned so the rupee figures line up on their last digit.
        <div className="pg-panel max-h-[calc(100vh-15rem)] overflow-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="pg-thead">
              <tr className="border-b border-border">
                {[
                  { label: "Date" },
                  { label: "Customer" },
                  { label: "Model" },
                  { label: "KVA", numeric: true },
                  { label: "Location" },
                  { label: "Qty", numeric: true },
                  { label: "Unit ₹", numeric: true },
                  { label: "Total ₹", numeric: true },
                  { label: "Sales Exec" },
                  ...(canDelete ? [{ label: "Actions", numeric: true }] : []),
                ].map((h) => (
                  <th
                    key={h.label}
                    scope="col"
                    className={cn(
                      "whitespace-nowrap px-4 py-2.5 text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground",
                      h.numeric ? "text-right" : "text-left",
                    )}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sales.length === 0 ? (
                <tr>
                  <td
                    // 9 data columns (Date…Sales Exec) plus Actions when the
                    // user can void. Was 9/8 — one short either way, so the
                    // "No sales recorded yet" cell stopped short of the last
                    // column and the empty state sat off-centre.
                    colSpan={canDelete ? 10 : 9}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No sales recorded yet.
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-accent/40">
                    <td className="whitespace-nowrap px-4 py-2 font-mono tabular-nums">
                      {formatDate(s.saleDate)}
                    </td>
                    <td className="px-4 py-2 font-medium">{s.customerName}</td>
                    <td className="px-4 py-2">{s.modelName}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{s.kva ?? "-"}</td>
                    <td className="px-4 py-2">{s.location || "-"}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{s.quantity}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {formatCurrency(s.unitPrice)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold tabular-nums">
                      {formatCurrency(s.totalAmount)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {s.salesExecutiveName || s.salesExecutive?.name || "-"}
                    </td>
                    {canDelete && (
                      <td className="px-4 py-2">
                        {/* Voiding a sale is irreversible, so unlike Edit/Delete
                            elsewhere this one keeps a visible text label rather
                            than becoming a bare icon. */}
                        <div className="flex justify-end">
                          <button
                            onClick={() => setConfirmDelete(s.id)}
                            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" /> Void
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button
            disabled={!data.meta.hasPrevPage}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40 hover:bg-accent"
          >
            Prev
          </button>
          <span className="text-muted-foreground">
            Page {page} of {data.meta.totalPages}
          </span>
          <button
            disabled={!data.meta.hasNextPage}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40 hover:bg-accent"
          >
            Next
          </button>
        </div>
      )}

      <SaleDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={() => refetch()} />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="pg-overlay w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-foreground">Void Sale</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Void this sale? The sold units will be returned to inventory stock.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onDelete(confirmDelete)}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Void Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
