import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RotateCcw, Search, Trash2, AlertTriangle } from "lucide-react";
import { useDeletedLeads, useRestoreLead, usePurgeLead } from "../hooks/useLeads";
import { useAppSelector } from "@/app/hooks";
import { PageLoader } from "@/shared/components/PageLoader";
import { RecordCard } from "@/shared/components/RecordCard";
import { useIsMobile } from "@/shared/hooks/useMediaQuery";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { formatDate } from "@/lib/utils";
import type { Lead } from "../types";

/**
 * Days left before the nightly sweep removes a lead for good.
 *
 * Returns null for a lead deleted before the retention policy existed — those
 * carry no purge date and are never swept, so a countdown would be a lie.
 */
function daysLeft(purgeAt: string | null | undefined): number | null {
  if (!purgeAt) return null;
  const ms = new Date(purgeAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

function Countdown({ lead }: { lead: Lead }) {
  const left = daysLeft(lead.purgeAt);
  if (left === null) {
    return <span className="text-muted-foreground">Kept — deleted before the 7-day policy</span>;
  }
  return (
    <span className={left <= 2 ? "font-medium text-destructive" : "text-muted-foreground"}>
      <span className="font-mono tabular-nums">{left}</span> day{left === 1 ? "" : "s"} left
    </span>
  );
}

/**
 * The lead recycle bin.
 *
 * A deleted lead stays here for 7 days and can be put back; after that a daily
 * job on the server removes it permanently. Restoring is a manager action,
 * wiping one early is admin-only — the API enforces both.
 */
export function LeadTrashPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const canPurge = role === "admin";
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useDeletedLeads({
    search: search || undefined,
    page,
    limit: 25,
  });

  const restore = useRestoreLead();
  const purge = usePurgeLead();
  const [confirmPurge, setConfirmPurge] = useState<Lead | null>(null);

  async function onRestore(lead: Lead) {
    try {
      await restore.mutateAsync(lead.id);
      toast.success(`${lead.customerName} restored`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function onPurge() {
    if (!confirmPurge) return;
    try {
      await purge.mutateAsync(confirmPurge.id);
      toast.success(`${confirmPurge.customerName} permanently deleted`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
    setConfirmPurge(null);
  }

  const rows = data?.items ?? [];
  const total = data?.meta.total ?? 0;

  return (
    <div className="erp-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/leads"
            className="mb-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to leads
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Recycle Bin</h1>
          <p className="text-sm text-muted-foreground">
            Deleted leads stay here for 7 days, then are removed automatically.{" "}
            <span className="font-mono tabular-nums text-foreground">{total}</span> in the bin.
          </p>
        </div>
        <label className="relative block w-full md:w-72">
          <span className="sr-only">Search the recycle bin</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, mobile or city..."
            className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring md:h-auto md:py-2"
          />
        </label>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {getApiErrorMessage(error)}
        </div>
      ) : isLoading ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <p className="pg-panel px-4 py-12 text-center text-sm text-muted-foreground">
          The recycle bin is empty.
        </p>
      ) : isMobile ? (
        <div className="space-y-2">
          {rows.map((l) => (
            <RecordCard
              key={l.id}
              title={l.customerName}
              meta={[l.mobile || "—", l.city || "—", <Countdown lead={l} />]}
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => onRestore(l)}
                    disabled={restore.isPending}
                    className="pg-tap flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </button>
                  {canPurge && (
                    <button
                      type="button"
                      onClick={() => setConfirmPurge(l)}
                      className="pg-tap flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-destructive/30 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  )}
                </>
              }
            />
          ))}
        </div>
      ) : (
        <div className="pg-panel overflow-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="pg-thead">
              <tr className="border-b border-border">
                {["Customer", "Mobile", "City", "Status", "Deleted", "Auto-removes", ""].map(
                  (h, i) => (
                    <th
                      key={h || i}
                      scope="col"
                      className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-accent/40">
                  <td className="px-4 py-2 font-medium">{l.customerName}</td>
                  <td className="px-4 py-2 font-mono tabular-nums">{l.mobile || "—"}</td>
                  <td className="px-4 py-2">{l.city || "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{l.status}</td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono tabular-nums text-muted-foreground">
                    {l.deletedAt ? formatDate(l.deletedAt) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs">
                    <Countdown lead={l} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onRestore(l)}
                        disabled={restore.isPending}
                        title={`Restore ${l.customerName}`}
                        className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Restore
                      </button>
                      {canPurge && (
                        <button
                          onClick={() => setConfirmPurge(l)}
                          title={`Permanently delete ${l.customerName}`}
                          className="rounded-md border border-destructive/30 bg-destructive/10 p-1.5 text-destructive transition-colors hover:bg-destructive/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page <span className="font-mono tabular-nums">{page}</span> of{" "}
            <span className="font-mono tabular-nums">{data.meta.totalPages}</span>
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!data.meta.hasPrevPage}
              className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.meta.hasNextPage}
              className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {confirmPurge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="pg-overlay w-full max-w-md p-6" role="dialog" aria-modal="true">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-foreground">
                  Permanently delete {confirmPurge.customerName}?
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  This removes the lead and its history from the database. It cannot be undone, and
                  it does not wait for the 7-day window.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmPurge(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={onPurge}
                disabled={purge.isPending}
                data-testid="confirm-purge"
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              >
                Delete for good
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
