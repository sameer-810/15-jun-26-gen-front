import { useState } from "react";
import { Activity as ActivityIcon, RefreshCw, Send, Search, SlidersHorizontal } from "lucide-react";
import { useActivities, useCreateNote } from "../hooks/useActivities";
import { ACTIVITY_META, ACTIVITY_TYPES, ENTITY_TYPES } from "../constants/activity.constants";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { cn, formatDateTime } from "@/lib/utils";
import { PageLoader } from "@/shared/components/PageLoader";
import { useIsMobile } from "@/shared/hooks/useMediaQuery";
import { FilterShell } from "@/shared/components/FilterShell";
import { Sheet } from "@/shared/components/Sheet";
import { Fab } from "@/shared/components/Fab";
import type { ActivityType, EntityType } from "../types";

const selectCls =
  "w-full md:w-auto rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";

export function ActivityFeedPage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ActivityType | "">("");
  const [entityType, setEntityType] = useState<EntityType | "">("");
  const [page, setPage] = useState(1);
  const [note, setNote] = useState("");
  const isMobile = useIsMobile();
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  // Search excluded — it keeps its own always-visible box on mobile.
  const activeFilterCount = [type, entityType].filter(Boolean).length;

  const { data, isLoading, refetch } = useActivities({
    search: search || undefined,
    type: type || undefined,
    entityType: entityType || undefined,
    page,
    limit: 50,
  });
  const createNote = useCreateNote();
  const items = data?.items ?? [];

  async function addNote() {
    if (!note.trim()) {
      toast.error("Enter a note");
      return;
    }
    try {
      await createNote.mutateAsync({ remarks: note.trim() });
      toast.success("Note added");
      setNote("");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="erp-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ActivityIcon className="hidden h-5 w-5 text-primary md:block" />
          <div className="min-w-0">
            <h1 className="hidden text-xl font-bold text-foreground md:block">Activity Log</h1>
            <p className="text-sm text-muted-foreground">
              <span className="hidden md:inline">
                Audit trail of leads, quotations, sales &amp; inventory ·{" "}
              </span>
              <span className="font-mono tabular-nums">{data?.meta.total ?? 0}</span> entries
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          aria-label="Refresh"
          className="pg-tap flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:min-h-0 md:min-w-0 md:border md:border-border md:bg-card md:px-3 md:py-2 md:text-foreground"
        >
          <RefreshCw className="h-4 w-4" />
          <span className="hidden md:inline">Refresh</span>
        </button>
      </div>

      {/*
        Manual note composer.

        Desktop keeps it inline. On a phone it and the filter block together
        filled the entire first screen, so the audit trail — the thing the page
        is — began below the fold. Behind the FAB instead: the note is written
        occasionally, the log is read constantly, and the screen should be
        arranged around the second.
      */}
      <div className={cn("pg-tile flex flex-wrap items-end gap-3", isMobile && "hidden")}>
        <div className="flex-1 min-w-[260px]">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Add a manual note (e.g. customer visit)
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNote()}
            placeholder="Visited customer site, discussed AMC..."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
          />
        </div>
        <button
          onClick={addNote}
          disabled={createNote.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-sm transition-colors"
        >
          <Send className="h-4 w-4" /> Add Note
        </button>
      </div>

      {/* Mobile: search stays out, the two selects go into a sheet. */}
      {isMobile && (
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Action, customer, user…"
              aria-label="Search the activity log"
              className="h-11 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
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
        </div>
      )}

      <FilterShell
        isMobile={isMobile}
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        total={data?.meta.total}
      >
        <div className={isMobile ? "hidden" : "flex-1 min-w-[200px]"}>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Search</label>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Action, customer, user, remarks..."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
          />
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Type</span>
          <select
            className={selectCls}
            value={type}
            onChange={(e) => {
              setType(e.target.value as ActivityType | "");
              setPage(1);
            }}
          >
            <option value="">All</option>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_META[t].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Entity</span>
          <select
            className={selectCls}
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value as EntityType | "");
              setPage(1);
            }}
          >
            <option value="">All</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </select>
        </label>
      </FilterShell>

      {/* Timeline */}
      {isLoading ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <div className="pg-tile p-12 text-center text-muted-foreground">No activity yet.</div>
      ) : (
        <div className="pg-panel divide-y divide-border">
          {items.map((a) => {
            const meta = ACTIVITY_META[a.type];
            const Icon = meta?.icon ?? ActivityIcon;
            return (
              <div
                key={a.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted ${meta?.color ?? ""}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="font-medium text-foreground">{a.action}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(a.createdAt)}
                    </span>
                  </div>
                  {a.remarks && <p className="text-sm text-muted-foreground">{a.remarks}</p>}
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5">
                      {meta?.label ?? a.type}
                    </span>
                    {a.entityLabel && <span>· {a.entityLabel}</span>}
                    <span>· by {a.userName || a.user?.name || "system"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button
            disabled={!data.meta.hasPrevPage}
            onClick={() => setPage((p) => p - 1)}
            className="pg-tap rounded-lg border border-border px-3 hover:bg-accent disabled:opacity-40 md:min-h-0 md:min-w-0 md:py-1.5"
          >
            Prev
          </button>
          <span className="text-muted-foreground">
            Page <span className="font-mono tabular-nums">{page}</span> of{" "}
            <span className="font-mono tabular-nums">{data.meta.totalPages}</span>
          </span>
          <button
            disabled={!data.meta.hasNextPage}
            onClick={() => setPage((p) => p + 1)}
            className="pg-tap rounded-lg border border-border px-3 hover:bg-accent disabled:opacity-40 md:min-h-0 md:min-w-0 md:py-1.5"
          >
            Next
          </button>
        </div>
      )}

      <Fab label="Add note" icon={Send} onClick={() => setNoteSheetOpen(true)} />

      <Sheet
        open={noteSheetOpen}
        onOpenChange={setNoteSheetOpen}
        title="Add a note"
        footer={
          <button
            onClick={async () => {
              await addNote();
              setNoteSheetOpen(false);
            }}
            disabled={createNote.isPending}
            className="pg-tap w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {createNote.isPending ? "Adding…" : "Add note"}
          </button>
        }
      >
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            What happened? (e.g. customer visit)
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="Visited customer site, discussed AMC..."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </Sheet>
    </div>
  );
}
