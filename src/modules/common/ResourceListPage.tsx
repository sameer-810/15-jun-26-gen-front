import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";

interface Column<TItem> {
  header: string;
  getValue: (item: TItem) => React.ReactNode;
  className?: string | ((item: TItem) => string | undefined);
}

interface ResourceListPageProps<TItem extends { id: string }, TQuery extends object> {
  title: string;
  subtitle?: string;
  newButtonText?: string;
  searchPlaceholder?: string;
  minTableWidth?: string;
  emptyText?: string;
  deleteConfirmText?: string;
  hideActionsColumn?: boolean;
  hideCreateButton?: boolean;
  columns: Column<TItem>[];
  useList: (query: TQuery) => {
    data?: {
      items: TItem[];
      meta: { total: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean };
    };
    isLoading: boolean;
    error: unknown;
    refetch: () => Promise<unknown>;
  };
  useDelete?: () => { mutateAsync: (id: string) => Promise<unknown>; isPending?: boolean };
  buildQuery: (args: { search: string; page: number; limit: number }) => TQuery;
  renderFilters?: (args: { search: string; setSearch: (v: string) => void }) => React.ReactNode;
  hideDefaultSearch?: boolean;
  renderDialog?: (args: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: "create" | "edit";
    value: TItem | null;
    onSuccess: () => void;
  }) => React.ReactNode;
  renderActions?: (
    item: TItem,
    onEdit: (item: TItem) => void,
    onRequestDelete: (id: string) => void,
  ) => React.ReactNode;
  /**
   * Enable per-row checkboxes. Return false for a row that must not be
   * selectable (e.g. a lead that is still live and so can't be bulk-deleted).
   * Selection is page-local and clears whenever the query changes.
   */
  isRowSelectable?: (item: TItem) => boolean;
  /** Bar rendered above the table while at least one row is selected. */
  renderBulkActions?: (args: { ids: string[]; clear: () => void }) => React.ReactNode;
}

export function ResourceListPage<TItem extends { id: string }, TQuery extends object>({
  title,
  subtitle,
  newButtonText = "New",
  searchPlaceholder = "Search...",
  minTableWidth = "min-w-[800px]",
  emptyText = "No records found.",
  deleteConfirmText = "Delete this record? This cannot be undone.",
  hideActionsColumn,
  hideCreateButton,
  columns,
  useList,
  useDelete,
  buildQuery,
  renderFilters,
  hideDefaultSearch,
  renderDialog,
  renderActions,
  isRowSelectable,
  renderBulkActions,
}: ResourceListPageProps<TItem, TQuery>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<TItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const setSearchAndReset = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);
  const query = useMemo(
    () => buildQuery({ search, page, limit: pageSize }),
    [buildQuery, search, page, pageSize],
  );

  const { data, isLoading, error, refetch } = useList(query);
  const deleteMutation = useDelete?.();
  // Memoised so downstream useMemo/useEffect deps don't churn on every render
  // (the `?? []` fallback would otherwise be a fresh array each time).
  const items = useMemo(() => data?.items ?? [], [data]);
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, data?.meta?.totalPages ?? 1);
  const hasNext = data?.meta?.hasNextPage ?? false;
  const hasPrev = data?.meta?.hasPrevPage ?? false;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total);

  useEffect(() => {
    if (!isLoading && page > totalPages) setPage(totalPages);
  }, [page, totalPages, isLoading]);

  // Selection is page-local: changing the page, search or any filter clears it
  // so a bulk action can never reach rows the user is no longer looking at.
  // Keyed on the serialised query because `buildQuery` is an inline arrow in
  // every caller, so `query` is a fresh object on each render — depending on
  // its identity would wipe the selection the instant it was made.
  const queryKey = JSON.stringify(query);
  useEffect(() => {
    setSelected([]);
  }, [queryKey]);

  const selectableIds = useMemo(
    () => (isRowSelectable ? items.filter(isRowSelectable).map((i) => i.id) : []),
    [items, isRowSelectable],
  );
  const allSelected = selectableIds.length > 0 && selected.length === selectableIds.length;
  const clearSelection = useCallback(() => setSelected([]), []);
  const toggleRow = useCallback(
    (id: string) =>
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [],
  );
  const toggleAll = useCallback(
    () => setSelected((prev) => (prev.length === selectableIds.length ? [] : selectableIds)),
    [selectableIds],
  );
  const selectionEnabled = Boolean(isRowSelectable);
  const extraCols = (hideActionsColumn ? 0 : 1) + (selectionEnabled ? 1 : 0);

  const onEdit = useCallback((item: TItem) => {
    setMode("edit");
    setEditing(item);
    setDialogOpen(true);
  }, []);

  const onDelete = useCallback(
    async (id: string) => {
      if (!deleteMutation) return;
      try {
        await deleteMutation.mutateAsync(id);
        toast.success("Deleted successfully");
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      }
      setConfirmDelete(null);
    },
    [deleteMutation],
  );

  const pageNums = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, 4, "…", totalPages];
    if (page >= totalPages - 2)
      return [1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "…", page - 1, page, page + 1, "…", totalPages];
  }, [page, totalPages]);

  return (
    <div className="erp-page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">
              {subtitle} · {total} records
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </button>
          {!hideCreateButton && renderDialog && (
            <button
              onClick={() => {
                setMode("create");
                setEditing(null);
                setDialogOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              {newButtonText}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {renderFilters ? (
        renderFilters({ search, setSearch: setSearchAndReset })
      ) : !hideDefaultSearch ? (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Search</label>
          <input
            value={search}
            onChange={(e) => setSearchAndReset(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full max-w-lg rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
          />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error instanceof Error ? error.message : "An error occurred"}
        </div>
      ) : null}

      {/* Bulk action bar — only while a selection exists */}
      {selectionEnabled && selected.length > 0 && renderBulkActions && (
        <div
          data-testid="bulk-action-bar"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 shadow-sm"
        >
          <span className="text-sm font-medium text-foreground">
            {selected.length} selected on this page
          </span>
          <div className="flex items-center gap-2">
            {renderBulkActions({ ids: selected, clear: clearSelection })}
            <button
              onClick={clearSelection}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-auto rounded-xl border border-border bg-card shadow-sm min-h-[400px]">
        <table className={cn("w-full text-sm", minTableWidth)}>
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {selectionEnabled && (
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all deletable rows on this page"
                    data-testid="select-all"
                    disabled={selectableIds.length === 0}
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-input accent-primary disabled:opacity-40"
                  />
                </th>
              )}
              {!hideActionsColumn && (
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-40">
                  Actions
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.header}
                  className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length + extraCols}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  <div className="flex justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + extraCols}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                  {selectionEnabled && (
                    <td className="px-4 py-2.5">
                      {isRowSelectable?.(item) ? (
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          data-testid={`select-row-${item.id}`}
                          checked={selected.includes(item.id)}
                          onChange={() => toggleRow(item.id)}
                          className="h-4 w-4 rounded border-input accent-primary"
                        />
                      ) : null}
                    </td>
                  )}
                  {!hideActionsColumn && (
                    <td className="px-4 py-2.5">
                      {renderActions ? (
                        renderActions(item, onEdit, setConfirmDelete)
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onEdit(item)}
                            className="flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          {deleteMutation && (
                            <button
                              onClick={() => setConfirmDelete(item.id)}
                              className="flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.header}
                      className={cn(
                        "px-4 py-2.5",
                        typeof col.className === "function" ? col.className(item) : col.className,
                      )}
                    >
                      {col.getValue(item)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm text-sm">
        <span className="text-muted-foreground">
          Showing {rangeStart}–{rangeEnd} of {total}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(1)}
            disabled={!hasPrev}
            className="rounded p-1 hover:bg-accent disabled:opacity-40"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={!hasPrev}
            className="rounded p-1 hover:bg-accent disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pageNums.map((n, i) =>
            n === "…" ? (
              <span key={`e${i}`} className="px-1 text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={n}
                onClick={() => setPage(n as number)}
                className={cn(
                  "w-8 h-8 rounded text-sm font-medium transition-colors",
                  page === n ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {n}
              </button>
            ),
          )}
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext}
            className="rounded p-1 hover:bg-accent disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={!hasNext}
            className="rounded p-1 hover:bg-accent disabled:opacity-40"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-foreground">Confirm Delete</h3>
            <p className="mt-2 text-sm text-muted-foreground">{deleteConfirmText}</p>
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
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog */}
      {renderDialog?.({
        open: dialogOpen,
        onOpenChange: setDialogOpen,
        mode,
        value: editing,
        onSuccess: () => {
          setPage(1);
          void refetch();
        },
      })}
    </div>
  );
}
