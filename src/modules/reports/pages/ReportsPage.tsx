import { useMemo, useState } from "react";
import { BarChart3, Download } from "lucide-react";
import { useReport } from "../hooks/useReports";
import { reportExportPath, type ReportName } from "../api/reportsApi";
import { downloadAuthenticatedFile } from "@/shared/lib/downloadFile";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { PageLoader } from "@/shared/components/PageLoader";
import { useAppSelector } from "@/app/hooks";
import { useIsMobile } from "@/shared/hooks/useMediaQuery";

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

/**
 * Turn a camelCase report field into a readable label.
 *
 * Splits only where a lower-case or digit is followed by an upper-case, so
 * `totalAmount` becomes "total Amount" while an acronym stays intact. The naive
 * `/([A-Z])/g` version put a space before *every* capital and rendered the kVA
 * column as "K V A".
 */
function humanise(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

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
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
        >
          <span className="capitalize text-muted-foreground">{humanise(k)}:</span>
          <strong className="font-mono tabular-nums text-foreground">{String(v)}</strong>
        </span>
      ))}
    </div>
  );
}

export function ReportsPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const isMobile = useIsMobile();
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
        <BarChart3 className="hidden h-5 w-5 text-primary md:block" />
        <div className="min-w-0">
          {/* The top bar already says "Reports" on mobile. */}
          <h1 className="hidden text-xl font-bold text-foreground md:block">Reports</h1>
          <p className="text-sm text-muted-foreground">View and export business reports as Excel</p>
        </div>
      </div>

      {/* Five report names wrapped onto two rows at 390px, so the date range and
          the data below it started a third of the way down the screen. One
          scrolling line instead. */}
      <div className="pg-chips md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            aria-pressed={active === t.key}
            className={`pg-chip md:rounded-lg md:px-4 ${
              active === t.key
                ? "md:bg-primary md:text-primary-foreground md:shadow-sm"
                : "md:border-border md:bg-card md:hover:bg-accent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pg-tile flex flex-wrap items-end gap-3">
        {showDates && (
          <>
            {/* Wrapping labels — the captions were siblings with no htmlFor,
                so nothing tied "From" and "To" to their date inputs. */}
            <label className="block min-w-0 flex-1 md:flex-none">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">From</span>
              <input
                type="date"
                className={`${inputCls} w-full md:w-auto`}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="block min-w-0 flex-1 md:flex-none">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">To</span>
              <input
                type="date"
                className={`${inputCls} w-full md:w-auto`}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </>
        )}
        <button
          onClick={onExport}
          className="pg-tap flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 md:ml-auto md:min-h-0 md:w-auto md:px-4 md:py-2"
        >
          <Download className="h-4 w-4" /> Export Excel
        </button>
      </div>

      {data?.summary && <SummaryChips summary={data.summary} />}

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {getApiErrorMessage(error)}
        </div>
      ) : isLoading ? (
        <PageLoader />
      ) : isMobile ? (
        /*
          Report rows are dynamic — the columns differ per report and are not
          known here — so the mobile view is a generic one: the first field is
          the record's heading and the rest become labelled pairs. That is the
          only honest rendering when the shape is unknown, and it beats a table
          whose last columns are cut off the right edge with no way to reach
          them.
        */
        <div className="space-y-2">
          {!data?.rows.length ? (
            <p className="pg-panel px-4 py-12 text-center text-sm text-muted-foreground">
              No data for this report.
            </p>
          ) : (
            data.rows.map((row, i) => (
              <div key={i} className="pg-card">
                <p className="mb-2 text-sm font-semibold text-foreground">
                  {String(row[columns[0]] ?? "—")}
                </p>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {columns.slice(1).map((c) => (
                    <div key={c} className="min-w-0">
                      <dt className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                        {humanise(c)}
                      </dt>
                      <dd className="truncate font-mono text-xs tabular-nums text-foreground">
                        {String(row[c] ?? "—")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="pg-panel min-h-[300px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="pg-thead">
              <tr className="border-b border-border">
                {columns.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground"
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
                  <tr key={i} className="transition-colors hover:bg-accent/40">
                    {columns.map((c) => (
                      <td key={c} className="whitespace-nowrap px-4 py-2.5">
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
