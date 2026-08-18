import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { usePerformance } from "../hooks/useHr";
import { useAssignableUsers } from "@/modules/lead/hooks/useLeads";
import { useAppSelector } from "@/app/hooks";
import { PageLoader } from "@/shared/components/PageLoader";
import { StatCard } from "@/shared/components/StatCard";
import { formatCurrency } from "@/lib/utils";
import type { AttendanceStatus, TargetRow } from "../api/hrApi";

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  half_day: "Half day",
  absent: "Absent",
  incomplete: "Not logged out",
  leave: "Leave",
  week_off: "Week off",
};

const STATUS_TONE: Record<AttendanceStatus, string> = {
  present: "text-success",
  half_day: "text-warning",
  absent: "text-destructive",
  incomplete: "text-destructive",
  leave: "text-muted-foreground",
  week_off: "text-muted-foreground",
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function hhmm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function TargetBar({ row }: { row: TargetRow }) {
  const isValue = row.metric === "sales_value";
  const pct = Math.min(100, row.percent);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{isValue ? "Sales value" : "Conversions"}</span>
        <span className="font-mono tabular-nums">
          <span className="font-medium text-foreground">
            {isValue ? formatCurrency(row.achieved) : row.achieved}
          </span>
          <span className="text-muted-foreground">
            {" / "}
            {isValue ? formatCurrency(row.target) : row.target}
          </span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${row.percent >= 100 ? "bg-success" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        <span className="font-mono tabular-nums">{row.percent}%</span> of target
      </p>
    </div>
  );
}

/**
 * "My Performance" — SRS 3.5.
 *
 * The requirement is that an employee sees exactly what the admin sees about
 * them. That is satisfied structurally rather than by discipline: this one page
 * reads one endpoint, and the server decides whose figures come back. An admin
 * gets an employee picker; everyone else silently gets themselves, because the
 * scoping happens in the service and not in this component.
 */
export function MyPerformancePage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const isPrivileged = role === "admin" || role === "manager";
  const [userId, setUserId] = useState("");
  const [month, setMonth] = useState(currentMonth());

  const staff = useAssignableUsers(isPrivileged);
  const { data, isLoading, error } = usePerformance({
    userId: isPrivileged && userId ? userId : undefined,
    month,
  });

  if (isLoading) return <PageLoader />;
  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Could not load performance: {error instanceof Error ? error.message : "unknown error"}
      </div>
    );
  }

  return (
    <div className="erp-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {isPrivileged && userId ? data.employee.name : "My Performance"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Attendance, earnings and targets for this month.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {isPrivileged && (
            <div>
              <label
                htmlFor="perf-user"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Employee
              </label>
              <select
                id="perf-user"
                data-testid="performance-user"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Me</option>
                {(staff.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label
              htmlFor="perf-month"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Month
            </label>
            <input
              id="perf-month"
              data-testid="performance-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {data.pay.unresolvedDays > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-sm text-foreground">
            <span className="font-mono font-medium tabular-nums">{data.pay.unresolvedDays}</span>{" "}
            day{data.pay.unresolvedDays === 1 ? "" : "s"} with no logout. These pay nothing until an
            admin settles them — they are not counted as absent either.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Payable Days"
          value={data.pay.payableDays}
          hint={`of ${data.pay.daysInMonth} in the month`}
        />
        <StatCard
          label="Gross Earned"
          value={formatCurrency(data.pay.grossEarned)}
          hint={`day rate ${formatCurrency(data.pay.dayRate)}`}
        />
        <StatCard
          label="Incentive"
          value={formatCurrency(data.incentive.incentiveEarned)}
          hint={`${data.incentive.incentiveRate}% of ${formatCurrency(data.incentive.salesValue)}`}
        />
        <StatCard
          label="Total"
          value={formatCurrency(data.totalEarned)}
          hint="before statutory deductions"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        These are <strong className="font-medium text-foreground">gross</strong> figures. PF, ESI
        and TDS are not calculated here — they are handled in payroll by your accountant.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="pg-tile lg:col-span-5">
          <h2 className="text-sm font-semibold text-foreground">Targets</h2>
          <p className="mb-4 text-xs text-muted-foreground">Against what you have closed</p>
          {data.targets.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No targets set for this month.
            </p>
          ) : (
            <div className="space-y-4">
              {data.targets.map((t) => (
                <TargetBar key={t.id} row={t} />
              ))}
            </div>
          )}
        </div>

        <div className="pg-panel lg:col-span-7">
          <div className="border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-semibold text-foreground">Attendance</h2>
            <p className="text-xs text-muted-foreground">Every day you logged in and out</p>
          </div>
          <div className="max-h-[26rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="pg-thead">
                <tr className="border-b border-border">
                  {["Date", "In", "Out", "Worked", "Status"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.days.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      Nothing recorded this month yet.
                    </td>
                  </tr>
                ) : (
                  data.days.map((d) => (
                    <tr key={d.id} className="transition-colors hover:bg-accent/40">
                      <td className="whitespace-nowrap px-4 py-2 font-mono tabular-nums">
                        {new Date(d.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </td>
                      <td className="px-4 py-2 font-mono tabular-nums">
                        {d.firstIn
                          ? new Date(d.firstIn.at).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-2 font-mono tabular-nums">
                        {d.lastOut
                          ? new Date(d.lastOut.at).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-2 font-mono tabular-nums">
                        {d.workedMinutes ? hhmm(d.workedMinutes) : "—"}
                      </td>
                      <td className={`px-4 py-2 ${STATUS_TONE[d.status]}`}>
                        {STATUS_LABELS[d.status]}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
