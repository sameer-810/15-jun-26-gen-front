import { useState } from "react";
import { CheckCircle2, CalendarOff } from "lucide-react";
import {
  useAttendance,
  useResolveDay,
  useSetTarget,
  useTargets,
  useMarkLeave,
  useClearLeave,
} from "../hooks/useHr";
import { useAssignableUsers } from "@/modules/lead/hooks/useLeads";
import { PageLoader } from "@/shared/components/PageLoader";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { cn, formatCurrency } from "@/lib/utils";
import { useIsMobile } from "@/shared/hooks/useMediaQuery";
import { RecordCard } from "@/shared/components/RecordCard";
import type { AttendanceDay, AttendanceStatus } from "../api/hrApi";

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  half_day: "Half day",
  absent: "Absent",
  incomplete: "Not punched out",
  leave: "Leave",
  week_off: "Week off",
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { from, to };
}

/**
 * Admin attendance and targets (SRS 3.1 / 3.5).
 *
 * The screen leads with unresolved days rather than a full month grid, because
 * that is the only part of attendance that needs a human: everything else has
 * already settled itself. A forgotten logout blocks that day's pay, so it is
 * shown first and resolved in place.
 */
export function AttendanceAdminPage() {
  const [month, setMonth] = useState(currentMonth());
  const [userId, setUserId] = useState("");
  const isMobile = useIsMobile();
  const { from, to } = monthBounds(month);

  const staff = useAssignableUsers(true);
  const { data, isLoading } = useAttendance({
    userId: userId || undefined,
    from,
    to,
    limit: 200,
  });
  const resolve = useResolveDay();

  const targets = useTargets({ userId: userId || undefined, month });
  const setTarget = useSetTarget();
  const [targetForm, setTargetForm] = useState({ metric: "sales_value", value: "" });

  const [resolving, setResolving] = useState<AttendanceDay | null>(null);
  const [outAt, setOutAt] = useState("");
  const [note, setNote] = useState("");

  const markLeave = useMarkLeave();
  const clearLeave = useClearLeave();
  const [leaveForm, setLeaveForm] = useState({ from: "", to: "", note: "" });

  const rows = data?.items ?? [];
  const unresolved = rows.filter((r) => r.status === "incomplete");

  async function submitLeave() {
    if (!userId) return toast.error("Pick an employee first");
    if (!leaveForm.from) return toast.error("Pick the first day of leave");
    try {
      const res = await markLeave.mutateAsync({
        userId,
        from: leaveForm.from,
        to: leaveForm.to || undefined,
        note: leaveForm.note || undefined,
      });
      toast.success(res.message);
      setLeaveForm({ from: "", to: "", note: "" });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function removeLeave(row: AttendanceDay) {
    if (!row.userId) return;
    try {
      await clearLeave.mutateAsync({ userId: row.userId, date: row.date });
      toast.success("Leave removed");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function submitResolve() {
    // A synthetic day has no id and no open punch, so it can never be the one
    // being settled — the guard keeps that guarantee local.
    if (!resolving?.id || !outAt) return;
    try {
      await resolve.mutateAsync({ id: resolving.id, outAt: new Date(outAt).toISOString(), note });
      toast.success("Day settled");
      setResolving(null);
      setOutAt("");
      setNote("");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function submitTarget() {
    if (!userId) return toast.error("Pick an employee first");
    const value = Number(targetForm.value);
    if (!Number.isFinite(value) || value < 0) return toast.error("Enter a target value");
    try {
      await setTarget.mutateAsync({
        userId,
        month,
        metric: targetForm.metric as "sales_value" | "conversions",
        value,
      });
      toast.success("Target set");
      setTargetForm({ metric: "sales_value", value: "" });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="erp-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="hidden text-xl font-semibold tracking-tight text-foreground md:block">
            Attendance &amp; Targets
          </h1>
          <p className="text-sm text-muted-foreground md:mt-1">
            {unresolved.length > 0 ? (
              <>
                <span className="font-mono font-medium tabular-nums text-destructive">
                  {unresolved.length}
                </span>{" "}
                day{unresolved.length === 1 ? "" : "s"} need settling
              </>
            ) : (
              "Every day this month has settled"
            )}
          </p>
        </div>
        {/* Two controls only, so they stay inline on a phone — side by side
            rather than behind a Filters sheet, which for two selects would be a
            tap to reach a tap. */}
        <div className="flex w-full flex-wrap items-end gap-2 md:w-auto">
          <div className="min-w-0 flex-1 md:flex-none">
            <label
              htmlFor="att-user"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Employee
            </label>
            <select
              id="att-user"
              data-testid="attendance-user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring md:h-auto md:w-auto md:py-1.5"
            >
              <option value="">Everyone</option>
              {(staff.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1 md:flex-none">
            <label
              htmlFor="att-month"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Month
            </label>
            <input
              id="att-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring md:h-auto md:w-auto md:py-1.5"
            />
          </div>
        </div>
      </div>

      {/* Approved leave. Worth a full day's pay, so it is a pay decision and
          sits with the admin. */}
      <div className="pg-tile">
        <h2 className="text-sm font-semibold text-foreground">Approved leave</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {userId
            ? "Leave is paid at the full day rate. A day the employee actually worked is left as it is."
            : "Pick an employee above to record their leave."}
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 md:flex-none">
            <label
              htmlFor="leave-from"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              First day
            </label>
            <input
              id="leave-from"
              data-testid="leave-from"
              type="date"
              value={leaveForm.from}
              onChange={(e) => setLeaveForm((f) => ({ ...f, from: e.target.value }))}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring md:h-auto md:w-auto md:py-1.5"
            />
          </div>
          <div className="min-w-0 flex-1 md:flex-none">
            <label
              htmlFor="leave-to"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Last day <span className="font-normal opacity-70">(optional)</span>
            </label>
            <input
              id="leave-to"
              data-testid="leave-to"
              type="date"
              value={leaveForm.to}
              onChange={(e) => setLeaveForm((f) => ({ ...f, to: e.target.value }))}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring md:h-auto md:w-auto md:py-1.5"
            />
          </div>
          <div className="min-w-0 flex-1">
            <label
              htmlFor="leave-note"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Reason <span className="font-normal opacity-70">(kept on the record)</span>
            </label>
            <input
              id="leave-note"
              value={leaveForm.note}
              onChange={(e) => setLeaveForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Sanctioned leave"
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring md:h-auto md:py-1.5"
            />
          </div>
          <button
            data-testid="leave-save"
            onClick={submitLeave}
            disabled={markLeave.isPending || !userId || !leaveForm.from}
            className="pg-tap flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 md:min-h-0 md:w-auto md:py-1.5"
          >
            <CalendarOff className="h-3.5 w-3.5" /> Mark leave
          </button>
        </div>
      </div>

      {/* Targets for the selected employee. */}
      <div className="pg-tile">
        <h2 className="text-sm font-semibold text-foreground">Targets for this month</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {userId
            ? "Achievement is computed from recorded sales, so it always matches the sales list."
            : "Pick an employee above to set their target."}
        </p>

        {(targets.data?.targets ?? []).length > 0 && (
          <div className="mb-3 space-y-2">
            {(targets.data?.targets ?? []).map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">
                  {t.userName} · {t.metric === "sales_value" ? "Sales value" : "Conversions"}
                </span>
                <span className="font-mono tabular-nums">
                  {t.metric === "sales_value" ? formatCurrency(t.achieved) : t.achieved}
                  <span className="text-muted-foreground">
                    {" / "}
                    {t.metric === "sales_value" ? formatCurrency(t.target) : t.target}
                  </span>{" "}
                  <span className={t.percent >= 100 ? "text-success" : "text-muted-foreground"}>
                    ({t.percent}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 md:flex-none">
            <label
              htmlFor="target-metric"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Metric
            </label>
            <select
              id="target-metric"
              value={targetForm.metric}
              onChange={(e) => setTargetForm((f) => ({ ...f, metric: e.target.value }))}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring md:h-auto md:w-auto md:py-1.5"
            >
              <option value="sales_value">Sales value (₹)</option>
              <option value="conversions">Conversions (count)</option>
            </select>
          </div>
          <div className="min-w-0 flex-1 md:flex-none">
            <label
              htmlFor="target-value"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Target
            </label>
            <input
              id="target-value"
              data-testid="target-value"
              type="number"
              min={0}
              value={targetForm.value}
              onChange={(e) => setTargetForm((f) => ({ ...f, value: e.target.value }))}
              className="no-spinner h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring md:h-auto md:w-40 md:py-1.5"
            />
          </div>
          <button
            data-testid="target-save"
            onClick={submitTarget}
            disabled={setTarget.isPending || !userId}
            className="pg-tap w-full rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 md:min-h-0 md:w-auto md:py-1.5"
          >
            Set target
          </button>
        </div>
      </div>

      {/*
        Attendance days.

        As a card list below `md`: the six columns are date, name, in, out,
        worked and status, and at 390px a table of them shows the first two.
        Times are the point of this screen, so they stay mono and stay together.
      */}
      {isMobile && (
        <div className="space-y-2">
          {rows.length === 0 ? (
            <p className="pg-panel px-4 py-12 text-center text-sm text-muted-foreground">
              No attendance recorded for this period.
            </p>
          ) : (
            rows.map((r) => (
              <RecordCard
                key={r.id ?? r.date}
                title={r.userName}
                amount={
                  <span className={r.status === "incomplete" ? "text-destructive" : undefined}>
                    {r.workedMinutes
                      ? `${Math.floor(r.workedMinutes / 60)}h ${String(r.workedMinutes % 60).padStart(2, "0")}m`
                      : "—"}
                  </span>
                }
                meta={[
                  new Date(r.date).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  }),
                  <span className="font-mono tabular-nums">
                    {r.firstIn
                      ? new Date(r.firstIn.at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                    {" → "}
                    {r.lastOut
                      ? new Date(r.lastOut.at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>,
                  <span className={r.status === "incomplete" ? "text-destructive" : undefined}>
                    {STATUS_LABELS[r.status]}
                  </span>,
                ]}
                actions={
                  r.status === "incomplete" ? (
                    <button
                      type="button"
                      data-testid={`resolve-${r.id}`}
                      onClick={() => {
                        setResolving(r);
                        setOutAt("");
                        setNote("");
                      }}
                      className="pg-tap flex flex-1 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                    >
                      Settle this day
                    </button>
                  ) : r.status === "leave" ? (
                    <button
                      type="button"
                      data-testid={`clear-leave-${r.id}`}
                      onClick={() => removeLeave(r)}
                      disabled={clearLeave.isPending}
                      className="pg-tap flex flex-1 items-center justify-center rounded-lg border border-border text-xs font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      Remove leave
                    </button>
                  ) : undefined
                }
              />
            ))
          )}
        </div>
      )}

      <div className={cn("pg-panel max-h-[calc(100vh-20rem)] overflow-auto", isMobile && "hidden")}>
        <table className="w-full min-w-[720px] text-sm">
          <thead className="pg-thead">
            <tr className="border-b border-border">
              {["Date", "Employee", "In", "Out", "Worked", "Status", ""].map((h, i) => (
                <th
                  key={h || i}
                  scope="col"
                  className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  No attendance recorded for this period.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id ?? r.date} className="transition-colors hover:bg-accent/40">
                  <td className="whitespace-nowrap px-4 py-2 font-mono tabular-nums">
                    {new Date(r.date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </td>
                  <td className="px-4 py-2 font-medium">{r.userName}</td>
                  <td className="px-4 py-2 font-mono tabular-nums">
                    {r.firstIn
                      ? new Date(r.firstIn.at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-2 font-mono tabular-nums">
                    {r.lastOut
                      ? new Date(r.lastOut.at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-2 font-mono tabular-nums">
                    {r.workedMinutes
                      ? `${Math.floor(r.workedMinutes / 60)}h ${String(r.workedMinutes % 60).padStart(2, "0")}m`
                      : "—"}
                  </td>
                  <td
                    className={`px-4 py-2 ${r.status === "incomplete" ? "text-destructive" : ""}`}
                  >
                    {STATUS_LABELS[r.status]}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.status === "incomplete" && (
                      <button
                        data-testid={`resolve-${r.id}`}
                        onClick={() => {
                          setResolving(r);
                          setOutAt("");
                          setNote("");
                        }}
                        className="rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-accent"
                      >
                        Settle
                      </button>
                    )}
                    {r.status === "leave" && (
                      <button
                        data-testid={`clear-leave-${r.id}`}
                        onClick={() => removeLeave(r)}
                        disabled={clearLeave.isPending}
                        className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-destructive disabled:opacity-50"
                      >
                        Remove leave
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {resolving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="pg-overlay w-full max-w-sm p-6" role="dialog" aria-modal="true">
            <h3 className="text-base font-semibold text-foreground">Settle this day</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {resolving.userName} logged in at{" "}
              <span className="font-mono tabular-nums">
                {resolving.firstIn
                  ? new Date(resolving.firstIn.at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </span>{" "}
              and never logged out. Enter when they actually finished.
            </p>
            <label
              htmlFor="resolve-out"
              className="mb-1 mt-4 block text-xs font-medium text-muted-foreground"
            >
              Punched out at
            </label>
            <input
              id="resolve-out"
              data-testid="resolve-out"
              type="datetime-local"
              value={outAt}
              onChange={(e) => setOutAt(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <label
              htmlFor="resolve-note"
              className="mb-1 mt-3 block text-xs font-medium text-muted-foreground"
            >
              Reason (kept on the record)
            </label>
            <input
              id="resolve-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Forgot to punch out at site"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setResolving(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                data-testid="resolve-confirm"
                onClick={submitResolve}
                disabled={resolve.isPending || !outAt}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Settle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
