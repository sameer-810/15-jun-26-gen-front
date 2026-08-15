import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

/**
 * Anything inside a row that already does something on click. A row-level
 * handler must defer to these, or clicking "Delete" would also open the record
 * behind the confirm dialog, and the mailto: link in the lead table would fire
 * a navigation at the same time as the mail client.
 *
 * `[data-row-ignore]` is the escape hatch for a cell that is interactive
 * without being one of these elements (an inline status dropdown, say).
 */
const INTERACTIVE_SELECTOR =
  "a, button, input, select, textarea, label, summary, [role='button'], [role='menuitem'], [role='checkbox'], [contenteditable='true'], [data-row-ignore]";

/**
 * True when the user is part-way through selecting text.
 *
 * This is the guard that makes row-click safe in a CRM specifically. Staff drag
 * across a cell to copy a mobile number or a GST figure out of the table, and
 * a click fires on mouseup at the end of that drag — so without this check,
 * every attempt to copy a phone number navigates away instead. The selection
 * has to be a non-empty Range that actually intersects this row: a stale
 * caret-collapsed selection elsewhere on the page must not block a real click.
 */
function isSelectingText(row: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
  if (sel.toString().trim() === "") return false;
  return sel.containsNode(row, true);
}

/** A modifier/middle click means "open in a new tab", the same as on a link. */
function wantsNewTab(e: React.MouseEvent): boolean {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1;
}

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
  /**
   * Makes the whole row open the record, the way every mature CRM behaves.
   *
   * Return the detail route for a row and clicking anywhere in it navigates
   * there — respecting ctrl/cmd/shift/middle-click as "open in a new tab", and
   * standing down whenever the click landed on something interactive or the
   * user was selecting text.
   *
   * This is strictly an *enhancement*: the anchor in the identifying cell must
   * stay, because that is what keyboard and screen-reader users navigate with
   * and what gives the browser a real URL to preview and copy. A `<tr>` cannot
   * do either of those jobs, which is why this is not implemented as one big
   * clickable row with `role="link"`.
   */
  rowHref?: (item: TItem) => string;
  /**
   * For resources with no detail page of their own, where "opening the record"
   * means the edit dialog. Ignored when `rowHref` is set.
   */
  rowOpensEditor?: boolean;
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
  rowHref,
  rowOpensEditor,
}: ResourceListPageProps<TItem, TQuery>) {
  const navigate = useNavigate();
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

  const rowIsClickable = Boolean(rowHref || rowOpensEditor);

  /**
   * Row activation. Deliberately conservative: it does nothing unless the click
   * was a plain click, on non-interactive space, with no text selected. A row
   * that opens a record when the user meant to copy a phone number is worse
   * than a row that never opened at all.
   */
  const onRowClick = useCallback(
    (e: React.MouseEvent<HTMLTableRowElement>, item: TItem) => {
      if (!rowIsClickable) return;
      if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
      if (isSelectingText(e.currentTarget)) return;

      const href = rowHref?.(item);
      if (!href) {
        // No detail route: "open" means the edit dialog. A new-tab gesture has
        // nothing to open, so it is ignored rather than faked.
        if (!wantsNewTab(e)) onEdit(item);
        return;
      }
      if (wantsNewTab(e)) {
        window.open(href, "_blank", "noopener,noreferrer");
      } else {
        navigate(href);
      }
    },
    [rowIsClickable, rowHref, navigate, onEdit],
  );

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
      {/* Header. The record count is mono so it stops shifting the subtitle's
          width every time the filter changes. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">
              {subtitle} · <span className="font-mono tabular-nums">{total}</span> records
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            Refresh
          </button>
          {!hideCreateButton && renderDialog && (
            <button
              onClick={() => {
                setMode("create");
                setEditing(null);
                setDialogOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              {newButtonText}
            </button>
          )}
        </div>
      </div>

      {/* Filters. The default search no longer sits in its own bordered, shadowed
          panel with a "Search" label above it — that was a box around a single
          input. The placeholder already says what it searches. */}
      {renderFilters ? (
        renderFilters({ search, setSearch: setSearchAndReset })
      ) : !hideDefaultSearch ? (
        <input
          value={search}
          onChange={(e) => setSearchAndReset(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full max-w-sm rounded-lg border border-input bg-card px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
        />
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error instanceof Error ? error.message : "An error occurred"}
        </div>
      ) : null}

      {/* Bulk action bar — only while a selection exists */}
      {selectionEnabled && selected.length > 0 && renderBulkActions && (
        <div
          data-testid="bulk-action-bar"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-2.5"
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

      {/*
        Table.

        Two structural changes, both about scanning rather than styling.

        The body now scrolls inside the panel with the header pinned, instead of
        the whole page scrolling and the column names disappearing after the
        eighth row. On a 50-row page across ten columns, losing the header is
        the single biggest cost in a table this wide.

        And "Actions" moved from the first column to the last. It was sitting in
        the anchor position — the leftmost column is what tells you *which
        record you are looking at*, and in this CRM that is the customer name.
        Two Edit/Delete buttons were occupying it on every screen, so every row
        began with the same identical pair of controls and the name was pushed
        into second place. Actions belong at the end of the row, after the data
        you read to decide whether to act.
      */}
      <div className="pg-panel max-h-[calc(100vh-15rem)] min-h-[24rem] overflow-auto">
        <table className={cn("w-full text-sm", minTableWidth)}>
          <thead className="pg-thead">
            <tr className="border-b border-border">
              {selectionEnabled && (
                <th scope="col" className="w-10 px-4 py-2.5 text-left">
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
              {columns.map((col) => (
                <th
                  key={col.header}
                  scope="col"
                  className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground"
                >
                  {col.header}
                </th>
              ))}
              {!hideActionsColumn && (
                <th
                  scope="col"
                  className="w-40 px-4 py-2.5 text-right text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground"
                >
                  Actions
                </th>
              )}
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
                <tr
                  key={item.id}
                  onClick={(e) => onRowClick(e, item)}
                  // `onClick` never fires for the middle button, so the
                  // open-in-new-tab gesture needs the auxiliary event too.
                  onAuxClick={(e) => {
                    if (e.button === 1) onRowClick(e, item);
                  }}
                  // Suppresses the middle-click autoscroll cursor, which
                  // otherwise appears over the table instead of opening a tab.
                  onMouseDown={(e) => {
                    if (e.button === 1 && rowIsClickable) e.preventDefault();
                  }}
                  className={cn(
                    "group transition-colors hover:bg-accent/40",
                    rowIsClickable && "cursor-pointer",
                  )}
                >
                  {selectionEnabled && (
                    <td className="px-4 py-2">
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
                  {columns.map((col) => (
                    <td
                      key={col.header}
                      className={cn(
                        "px-4 py-2",
                        typeof col.className === "function" ? col.className(item) : col.className,
                      )}
                    >
                      {col.getValue(item)}
                    </td>
                  ))}
                  {!hideActionsColumn && (
                    <td className="px-4 py-2">
                      {renderActions ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {renderActions(item, onEdit, setConfirmDelete)}
                        </div>
                      ) : (
                        /*
                          The default pair used to be a bordered grey "Edit" and
                          a red-filled "Delete" on every row — fifty rows of
                          filled red on a list screen, which trains people to
                          stop seeing red as dangerous. They are quiet icon
                          buttons now, labelled for screen readers, and Delete
                          only turns destructive on hover. The confirm dialog is
                          still the actual safeguard.
                        */
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onEdit(item)}
                            aria-label="Edit"
                            title="Edit"
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {deleteMutation && (
                            <button
                              onClick={() => setConfirmDelete(item.id)}
                              aria-label="Delete"
                              title="Delete"
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-2 text-sm">
        <span className="text-muted-foreground">
          Showing{" "}
          <span className="font-mono tabular-nums text-foreground">
            {rangeStart}–{rangeEnd}
          </span>{" "}
          of <span className="font-mono tabular-nums text-foreground">{total}</span>
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
                aria-current={page === n ? "page" : undefined}
                className={cn(
                  "h-7 w-7 rounded font-mono text-sm tabular-nums transition-colors",
                  page === n
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
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
          <div className="pg-overlay w-full max-w-sm p-6">
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
