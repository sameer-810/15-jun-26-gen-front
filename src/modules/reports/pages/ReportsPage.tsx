import { useMemo, useState } from "react";
import { BarChart3, Download } from "lucide-react";
import { useReport } from "../hooks/useReports";
import { reportExportPath, type ReportName } from "../api/reportsApi";
import { downloadAuthenticatedFile } from "@/shared/lib/downloadFile";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { PageLoader } from "@/shared/components/PageLoader";
import { useAppSelector } from "@/app/hooks";

const ALL_TABS: { key: ReportName; label: string; roles: string[] }[] = [
  { key: "sales", label: "Sales", roles: ["admin", "manager", "sales"] },
  { key: "leads", label: "Leads", roles: ["admin", "manager", "sales"] },
  { key: "follow-ups", label: "Follow-ups", roles: ["admin", "manager", "sales"] },
  { key: "inventory", label: "Inventory", roles: ["admin", "manager", "inventory"] },
  // SRS 3.2 — daily answered vs unanswered per employee. A sales exec may open
  // it; the server narrows the rows to their own calls.
  { key: "call-activity", label: "Call Activity", roles: ["admin", "manager", "sales"] },
];

const inputCls =
  "rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";

function SummaryChips({ summary }: { summary: Record<string, unknown> }) {
  const entries = Object.entries(summary).filter(
    ([, v]) => typeof v === "number" || typeof v === "string",
  );
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm shadow-sm"
        >
          <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1")}:</span>
          <strong className="text-foreground">{String(v)}</strong>
        </span>
      ))}
    </div>
  );
}

export function ReportsPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const tabs = useMemo(
    () => ALL_TABS.filter((t) => (role ? t.roles.includes(role) : false)),
    [role],
  );
  const [active, setActive] = useState<ReportName>(tabs[0]?.key ?? "sales");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const params = { startDate: startDate || undefined, endDate: endDate || undefined };
  const { data, isLoading, error } = useReport(active, params);

  const columns = data?.rows.length ? Object.keys(data.rows[0]) : [];

  async function onExport() {
    try {
      await downloadAuthenticatedFile(reportExportPath(active, params), `${active}-report.xlsx`);
      toast.success("Export downloaded");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  const showDates = active === "sales" || active === "leads";

  return (
    <div className="erp-page">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">View and export business reports as Excel</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              active === t.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-card hover:bg-accent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap items-end gap-3">
        {showDates && (
          <>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
              <input
                type="date"
                className={inputCls}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
              <input
                type="date"
                className={inputCls}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </>
        )}
        <button
          onClick={onExport}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors"
        >
          <Download className="h-4 w-4" /> Export Excel
        </button>
      </div>

      {data?.summary && <SummaryChips summary={data.summary} />}

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {getApiErrorMessage(error)}
        </div>
      ) : isLoading ? (
        <PageLoader />
      ) : (
        <div className="overflow-auto rounded-xl border border-border bg-card shadow-sm min-h-[300px]">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c}
                    className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(1, columns.length)}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No data for this report.
                  </td>
                </tr>
              ) : (
                data?.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    {columns.map((c) => (
                      <td key={c} className="px-4 py-2.5 whitespace-nowrap">
                        {String(row[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
