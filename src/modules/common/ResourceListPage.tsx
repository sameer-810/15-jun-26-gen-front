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
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { useIsMobile } from "@/shared/hooks/useMediaQuery";
import { Sheet } from "@/shared/components/Sheet";
import { Fab } from "@/shared/components/Fab";
import { RecordCard } from "@/shared/components/RecordCard";

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
  /**
   * Secondary actions for the header, beside Refresh — Import Leads, Build from
   * catalog, and the like.
   *
   * These used to be rendered by the page itself in a `justify-end` row *above*
   * `<ResourceListPage>`, which on a phone produced the Leads screen opening
   * with a lone "Import Leads" button sitting above its own page title. Given a
   * slot, they join the header row and collapse to icons at 390px like
   * everything else in it.
   */
  headerActions?: React.ReactNode;
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
  /**
   * The screen's filter controls.
   *
   * `layout` says where they are being drawn. On desktop they sit inline above
   * the table (`"inline"`); on a phone they are moved into a sheet
   * (`"sheet"`) behind a Filters button, because rendered inline they filled the
   * entire first screen — /leads opened with seven stacked controls and roughly
   * 1200px of form before the first lead appeared.
   *
   * A page must omit its own search field when `layout === "sheet"`: the list
   * puts search in the sticky toolbar itself, since it is the one filter used
   * often enough to deserve permanent space, and rendering it twice is the
   * obvious failure mode of moving the rest away.
   */
  renderFilters?: (args: {
    search: string;
    setSearch: (v: string) => void;
    layout: "inline" | "sheet";
  }) => React.ReactNode;
  /**
   * Number of filters currently narrowing the list, excluding search. Shown on
   * the mobile Filters button, because once the controls are behind a sheet
   * there is otherwise nothing to say the list is filtered — and a list that is
   * silently filtered reads as a list with missing records.
   */
  activeFilterCount?: number;
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
  /**
   * Bar rendered above the table while at least one row is selected.
   *
   * Receives the selected `items`, not just their ids, because a bar can carry
   * actions with different eligibility rules — on leads, anything may be
   * reassigned but only dead leads may be deleted. Without the items each
   * action would have to re-derive state it cannot see.
   */
  renderBulkActions?: (args: {
    ids: string[];
    items: TItem[];
    clear: () => void;
  }) => React.ReactNode;
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
  /**
   * How one record looks below `md`, where the table is replaced by cards.
   *
   * A table earns its keep by aligning a column so the eye can run down it. That
   * needs width; at 390px there is none, and every list here was 800–1500px
   * wide, so the table degraded into sideways panning — three columns visible,
   * the rest off-screen, and the customer name wrapped over three lines. Cards
   * drop the alignment deliberately and keep each record whole.
   *
   * Optional. Without it the list derives a serviceable card from the first few
   * columns, which is right for a secondary screen and wrong for a primary one:
   * a column order tuned for scanning a wide grid is not the order someone reads
   * on a phone, and only the page knows which two facts actually matter.
   */
  renderMobileCard?: (
    item: TItem,
    helpers: { onEdit: (item: TItem) => void; onRequestDelete: (id: string) => void },
  ) => React.ReactNode;
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
  headerActions,
  columns,
  useList,
  useDelete,
  buildQuery,
  renderFilters,
  activeFilterCount = 0,
  hideDefaultSearch,
  renderDialog,
  renderActions,
  isRowSelectable,
  renderBulkActions,
  rowHref,
  rowOpensEditor,
  renderMobileCard,
}: ResourceListPageProps<TItem, TQuery>) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  /**
   * Mobile-only selection mode.
   *
   * On desktop the checkbox column costs 40px once, in a header, and is free
   * after that. On a phone it costs 44px on the left of *every* card — a ninth
   * of the screen width, permanently, for an action most people use rarely.
   * Bulk assign is a manager's Monday-morning job, not something anyone does
   * from a customer's site, so it is opt-in: tap Select, the checkboxes appear.
   */
  const [selectMode, setSelectMode] = useState(false);
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
      {/*
        Header.

        On desktop: title and subtitle left, Refresh and the create button right.

        On a phone that same row wrapped into three — and because several pages
        render an extra control above the list (Import Leads, Build from
        catalog), the Leads screen opened with "Import Leads" floating alone on
        its own line *above* its own page title. So below `md` the title keeps
        the row to itself, Refresh becomes a quiet icon, and the create button
        leaves the flow entirely to become the FAB at the bottom of the screen.

        The record count is mono so it stops shifting the subtitle's width every
        time the filter changes.
      */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {/* Redundant on mobile — the top bar already names the screen. */}
          <h1 className="hidden text-xl font-semibold tracking-tight text-foreground md:block">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">
              <span className="hidden md:inline">{subtitle} · </span>
              <span className="font-mono tabular-nums">{total}</span> records
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectionEnabled && isMobile && (
            <button
              type="button"
              onClick={() => {
                setSelectMode((m) => !m);
                clearSelection();
              }}
              className={cn(
                "pg-tap flex items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors",
                selectMode
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              {selectMode ? "Done" : "Select"}
            </button>
          )}
          {headerActions}
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            aria-label="Refresh"
            className="pg-tap flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50 md:min-h-0 md:min-w-0 md:border md:border-border md:px-3 md:py-1.5"
          >
            <RefreshCw className={cn("h-4 w-4 md:h-3.5 md:w-3.5", isLoading && "animate-spin")} />
            <span className="hidden md:inline">Refresh</span>
          </button>
          {!hideCreateButton && renderDialog && (
            <button
              onClick={() => {
                setMode("create");
                setEditing(null);
                setDialogOpen(true);
              }}
              className="hidden items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 md:flex"
            >
              <Plus className="h-4 w-4" />
              {newButtonText}
            </button>
          )}
        </div>
      </div>

      {/*
        Filters.

        Desktop keeps them inline, as before. Below `md` they move into a sheet
        and only search stays on screen: rendered inline on a phone the Leads
        filter block was seven stacked controls — search, a Calls segmented
        control that wrapped onto two lines, location, a qty min/max pair, two
        date inputs, status and source — roughly 1200px of form standing between
        the user and the first record.

        Search stays out because it is the one filter used often enough to earn
        permanent space. The count on the Filters button is what stops a
        silently-filtered list from reading as a list with records missing.
      */}
      {isMobile ? (
        <div className="flex items-center gap-2">
          {!hideDefaultSearch && (
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearchAndReset(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                type="search"
                className="h-11 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
          {renderFilters && (
            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              aria-label="Filters"
              className={cn(
                "pg-tap flex shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
                activeFilterCount > 0
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="font-mono tabular-nums">{activeFilterCount}</span>
              )}
            </button>
          )}
        </div>
      ) : renderFilters ? (
        renderFilters({ search, setSearch: setSearchAndReset, layout: "inline" })
      ) : !hideDefaultSearch ? (
        <input
          value={search}
          onChange={(e) => setSearchAndReset(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full max-w-sm rounded-lg border border-input bg-card px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
        />
      ) : null}

      {isMobile && renderFilters && (
        <Sheet
          open={filterSheetOpen}
          onOpenChange={setFilterSheetOpen}
          title="Filters"
          footer={
            <button
              type="button"
              onClick={() => setFilterSheetOpen(false)}
              className="pg-tap w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Show <span className="font-mono tabular-nums">{total}</span> results
            </button>
          }
        >
          {renderFilters({ search, setSearch: setSearchAndReset, layout: "sheet" })}
        </Sheet>
      )}

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
            {renderBulkActions({
              ids: selected,
              items: items.filter((i) => selected.includes(i.id)),
              clear: clearSelection,
            })}
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
      {/*
        The card list — below `md` only, replacing the table entirely.

        `max-h` is deliberately absent here. On desktop the panel scrolls
        internally so the pinned header survives a 50-row page; on a phone that
        same rule produced a short scroll box inside a scrolling page inside a
        sideways-scrolling table — three scroll axes on one screen, and the
        outer one moving whenever the inner one hit its end. The cards just
        extend the page and the whole thing scrolls once.
      */}
      {isMobile && (
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : items.length === 0 ? (
            <p className="pg-panel px-4 py-12 text-center text-sm text-muted-foreground">
              {emptyText}
            </p>
          ) : (
            items.map((item) => {
              const card = renderMobileCard ? (
                renderMobileCard(item, { onEdit, onRequestDelete: setConfirmDelete })
              ) : (
                /*
                  Fallback for a screen that has not defined its own card. The
                  first column is the anchor — DESIGN.md puts the identifying
                  value there — and the next three become the meta line.
                */
                <RecordCard
                  title={columns[0]?.getValue(item)}
                  meta={columns.slice(1, 4).map((c) => c.getValue(item))}
                  to={rowHref?.(item)}
                  onClick={rowOpensEditor && !rowHref ? () => onEdit(item) : undefined}
                  actions={
                    !hideActionsColumn && renderActions ? (
                      <div className="flex flex-1 items-center gap-1.5">
                        {renderActions(item, onEdit, setConfirmDelete)}
                      </div>
                    ) : undefined
                  }
                />
              );

              if (!selectionEnabled || !selectMode) return <div key={item.id}>{card}</div>;
              return (
                <div key={item.id} className="flex items-start gap-2">
                  {isRowSelectable?.(item) ? (
                    <label className="pg-tap flex items-center justify-center">
                      <input
                        type="checkbox"
                        aria-label="Select record"
                        data-testid={`select-row-${item.id}`}
                        checked={selected.includes(item.id)}
                        onChange={() => toggleRow(item.id)}
                        className="h-5 w-5 rounded border-input accent-primary"
                      />
                    </label>
                  ) : (
                    <span className="w-11 shrink-0" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">{card}</div>
                </div>
              );
            })
          )}
        </div>
      )}

      <div
        className={cn(
          "pg-panel max-h-[calc(100vh-15rem)] min-h-[24rem] overflow-auto",
          isMobile && "hidden",
        )}
      >
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

      {/*
        Pagination.

        The desktop control is seven numbered pages, a rows-per-page select and
        four chevrons. At 390px it wrapped to three lines and every target was
        under 30px, so paging by thumb meant hitting page 4 when you wanted 3.

        Mobile gets the two controls that matter — previous and next, at full
        touch size — plus the range readout, which is the part that actually
        answers "where am I". Jump-to-page and rows-per-page are desktop
        affordances: on a phone you scroll, and page 7 of 55 is not a thing
        anyone navigates to deliberately.
      */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm md:px-4">
        <span className="text-muted-foreground">
          Showing{" "}
          <span className="font-mono tabular-nums text-foreground">
            {rangeStart}–{rangeEnd}
          </span>{" "}
          of <span className="font-mono tabular-nums text-foreground">{total}</span>
        </span>
        <div className="hidden items-center gap-2 md:flex">
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

        {/* Desktop: full pager. */}
        <div className="hidden items-center gap-1 md:flex">
          <button
            onClick={() => setPage(1)}
            disabled={!hasPrev}
            aria-label="First page"
            className="rounded p-1 hover:bg-accent disabled:opacity-40"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={!hasPrev}
            aria-label="Previous page"
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
            aria-label="Next page"
            className="rounded p-1 hover:bg-accent disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={!hasNext}
            aria-label="Last page"
            className="rounded p-1 hover:bg-accent disabled:opacity-40"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>

        {/* Mobile: prev / page-of / next, all at thumb size. */}
        <div className="flex items-center gap-1 md:hidden">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={!hasPrev}
            aria-label="Previous page"
            className="pg-tap flex items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="px-1.5 font-mono text-xs tabular-nums text-muted-foreground">
            {page}/{totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext}
            aria-label="Next page"
            className="pg-tap flex items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* The create action, lifted out of the header — see Fab. */}
      {!hideCreateButton && renderDialog && (
        <Fab
          label={newButtonText}
          onClick={() => {
            setMode("create");
            setEditing(null);
            setDialogOpen(true);
          }}
        />
      )}

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
