import { RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Link } from "react-router-dom";
import { useDashboard, useSalesAnalytics } from "../hooks/useDashboard";
import { RemindersPanel } from "@/modules/lead/components/RemindersPanel";
import { useAppSelector } from "@/app/hooks";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatCard } from "@/shared/components/StatCard";
import { Badge } from "@/shared/components/Badge";
import { LEAD_STATUS_LABELS } from "@/modules/lead/constants/lead.constants";
import type { LeadStatus } from "@/modules/lead/types";

const AMBER = "#F5A623";
const GREEN = "#16A34A";
// GST split (SRS 3.3). Cobalt for GST because it is the primary, compliant
// path; a desaturated teal for non-GST so the two are distinguishable without
// either reading as an alarm; grey for what nobody has classified yet.
const GST_COLOR = "#1C50C8";
const NON_GST_COLOR = "#0D9488";
const UNCLASSIFIED_COLOR = "#94A3B8";
const STATUS_COLORS: Record<string, string> = {
  new: "#3B82F6",
  important: "#F97316",
  contacted: "#0EA5E9",
  follow_up: "#F59E0B",
  quotation_sent: "#EAB308",
  negotiation: "#8B5CF6",
  other: "#94A3B8",
  deal_done: "#10B981",
  converted: "#16A34A",
  not_interested: "#EF4444",
  irrelevant: "#F43F5E",
};
const STATUS_TONE: Record<LeadStatus, "info" | "warning" | "success" | "danger"> = {
  new: "info",
  important: "warning",
  contacted: "info",
  follow_up: "warning",
  quotation_sent: "warning",
  negotiation: "warning",
  other: "info",
  deal_done: "success",
  converted: "success",
  not_interested: "danger",
  irrelevant: "danger",
};

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`pg-tile ${className ?? ""}`}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

/** Pipeline-by-stage bars — exposes where leads pile up (the bottleneck). */
function PipelineFunnel({
  stages,
  conversionRate,
}: {
  stages: { key: LeadStatus; label: string; count: number }[];
  conversionRate: number;
}) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">Lead-to-sale conversion</span>
        {/* Was gradient-filled cobalt→sky text. A percentage is a measurement,
            not a brand moment; weight and size carry the emphasis instead. */}
        <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
          {conversionRate}%
        </span>
      </div>
      {stages.map((s) => (
        <div key={s.key}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{s.label}</span>
            <span className="pg-nums font-semibold text-foreground">{s.count}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(s.count / max) * 100}%`, background: STATUS_COLORS[s.key] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Revenue split by how it was billed — SRS 3.3.
 *
 * Stacked bars rather than two side-by-side series: the question this answers
 * is "how much of our revenue goes through GST", which is a composition, and
 * composition reads off a stack far faster than off two bars you have to add up
 * yourself. Total height stays comparable month to month either way.
 *
 * `unclassified` gets its own grey band. Those are sales recorded before the
 * treatment field existed; folding them into either side would quietly
 * misstate the split, and showing them is what prompts someone to fix them.
 */
function GstRevenueChart() {
  const { data, isLoading } = useSalesAnalytics(12);

  if (isLoading) {
    return <div className="h-72 animate-pulse rounded-lg border border-border" />;
  }
  if (!data || data.totals.total === 0) {
    return (
      <div className="pg-tile">
        <h2 className="text-sm font-semibold text-foreground">Revenue — GST vs Non-GST</h2>
        <EmptyChart label="No sales recorded in the last 12 months" />
      </div>
    );
  }

  const gstShare = Math.round((data.totals.gst / data.totals.total) * 100);

  return (
    <div className="pg-tile">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Revenue — GST vs Non-GST</h2>
          <p className="text-xs text-muted-foreground">Last 12 months</p>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-mono font-medium tabular-nums text-foreground">{gstShare}%</span>{" "}
          billed under GST
        </p>
      </div>

      {data.unclassifiedCount > 0 && (
        <p className="mb-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
          <span className="font-mono font-medium tabular-nums">{data.unclassifiedCount}</span> sale
          {data.unclassifiedCount === 1 ? " has" : "s have"} no GST treatment recorded and are shown
          separately. Set it on each sale to fold them into the split.
        </p>
      )}

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.series} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(v: number) =>
                v >= 10000000
                  ? `${(v / 10000000).toFixed(1)}Cr`
                  : v >= 100000
                    ? `${(v / 100000).toFixed(1)}L`
                    : String(v)
              }
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--accent) / 0.10)" }}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: unknown, name: unknown) => [
                formatCurrency(value as number),
                name === "gst" ? "GST" : name === "non_gst" ? "Non-GST" : "Not classified",
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(v) =>
                v === "gst" ? "GST" : v === "non_gst" ? "Non-GST" : "Not classified"
              }
            />
            <Bar dataKey="gst" stackId="rev" fill={GST_COLOR} radius={[0, 0, 0, 0]} />
            <Bar dataKey="non_gst" stackId="rev" fill={NON_GST_COLOR} radius={[0, 0, 0, 0]} />
            <Bar
              dataKey="unclassified"
              stackId="rev"
              fill={UNCLASSIFIED_COLOR}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboard();
  const user = useAppSelector((s) => s.auth.user);

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load dashboard: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  // Surfaced in the page header rather than buried in a tile: these two are the
  // only numbers on the dashboard that imply someone has to do something today.
  const overdue = data?.followUps.overdue ?? 0;
  const dueToday = data?.followUps.dueToday ?? 0;

  const trend = data?.monthlyLeadTrend ?? [];
  const mix = (data?.leadStatusMix ?? []).filter((m) => m.count > 0);
  const topModels = data?.topModels ?? [];
  // Four roll-up buckets over the (now much wider) status list — the full
  // breakdown is in the status-mix chart below.
  const stages: { key: LeadStatus; label: string; count: number }[] = [
    { key: "new", label: "New", count: data?.leads.new ?? 0 },
    { key: "contacted", label: "Open", count: data?.leads.inProgress ?? 0 },
    { key: "converted", label: "Won", count: data?.leads.converted ?? 0 },
    { key: "not_interested", label: "Lost", count: data?.leads.lost ?? 0 },
  ];

  return (
    <div className="erp-page">
      {/*
        The header was a bordered "hero" panel with a blurred cobalt glow in the
        corner and the user's first name in gradient text, under the sentence
        "your generator business at a glance". All of it was decoration: a
        full-width box, ~120px of vertical space above the fold, carrying one
        greeting and a date the operating system already shows.

        A page title does not need a container. What earns the space instead is
        the one fact this screen exists to surface — how many follow-ups are
        overdue right now — stated in words, next to the title, in the colour
        that means "act on this".
      */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {user?.name ? `${user.name.split(" ")[0]}'s desk` : "Dashboard"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {overdue > 0 ? (
              <>
                <span className="font-mono font-medium tabular-nums text-destructive">
                  {overdue}
                </span>{" "}
                follow-{overdue === 1 ? "up is" : "ups are"} overdue
                {dueToday > 0 ? (
                  <>
                    {" · "}
                    <span className="font-mono font-medium tabular-nums text-warning">
                      {dueToday}
                    </span>{" "}
                    due today
                  </>
                ) : null}
              </>
            ) : dueToday > 0 ? (
              <>
                <span className="font-mono font-medium tabular-nums text-warning">{dueToday}</span>{" "}
                follow-{dueToday === 1 ? "up" : "ups"} due today · nothing overdue
              </>
            ) : (
              "No follow-ups overdue or due today"
            )}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/*
        Four headline figures. Only "Follow-ups Due" carries a tone, and only
        when there is genuinely something overdue — see the note in StatCard on
        why every tile being coloured means no tile reads as urgent.
      */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[5.5rem] animate-pulse rounded-lg border border-border" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Open Pipeline"
            value={formatCurrency(data?.pipeline.openValue ?? 0)}
            hint={`${data?.pipeline.openCount ?? 0} active leads`}
          />
          <StatCard
            label="Follow-ups Due"
            value={dueToday}
            tone={overdue > 0 ? "danger" : dueToday > 0 ? "warning" : "neutral"}
            hint={overdue > 0 ? `${overdue} already overdue` : "none overdue"}
          />
          <StatCard
            label="Conversion Rate"
            value={`${data?.conversionRate ?? 0}%`}
            hint={`${data?.leads.converted ?? 0} won of ${data?.leads.total ?? 0}`}
          />
          <StatCard
            label="Sales This Month"
            value={formatCurrency(data?.sales.thisMonthValue ?? 0)}
            hint={`${data?.sales.totalUnits ?? 0} units all-time`}
          />
        </div>
      )}

      {/* Bento row 1 — funnel (priority) + 6-month trend (wide) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <ChartCard
          title="Pipeline by Stage"
          subtitle="Where leads sit — spot the bottleneck"
          className="lg:col-span-5"
        >
          <PipelineFunnel stages={stages} conversionRate={data?.conversionRate ?? 0} />
        </ChartCard>

        <ChartCard
          title="Leads — Last 6 Months"
          subtitle="New vs. converted"
          className="lg:col-span-7"
        >
          <div className="h-60">
            {trend.every((t) => t.leads === 0) ? (
              <EmptyChart label="No leads in the last 6 months yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--accent) / 0.10)" }}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="leads" name="Leads" fill={AMBER} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="converted" name="Converted" fill={GREEN} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Bento row 2 — status mix + top models + recent leads (equal thirds) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <ChartCard title="Lead Status Mix" subtitle="Current pipeline" className="lg:col-span-4">
          <div className="h-56">
            {mix.length === 0 ? (
              <EmptyChart label="Add leads to see the mix" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mix}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  >
                    {mix.map((m) => (
                      <Cell key={m.status} fill={STATUS_COLORS[m.status] ?? AMBER} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: unknown, name: unknown) => [
                      value as number,
                      LEAD_STATUS_LABELS[name as LeadStatus] ?? String(name),
                    ]}
                  />
                  <Legend
                    formatter={(v) => LEAD_STATUS_LABELS[v as LeadStatus] ?? v}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Top-Selling Models" subtitle="By units sold" className="lg:col-span-4">
          <div className="h-56">
            {topModels.length === 0 ? (
              <EmptyChart label="No sales recorded yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topModels}
                  layout="vertical"
                  margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    dataKey="model"
                    type="category"
                    width={90}
                    tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--accent) / 0.10)" }}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: unknown, name: unknown) =>
                      name === "value"
                        ? [formatCurrency(value as number), "Value"]
                        : [value as number, "Units"]
                    }
                  />
                  <Bar dataKey="units" name="Units" fill={AMBER} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Recent Leads" subtitle="Latest enquiries" className="lg:col-span-4">
          {(data?.recentLeads?.length ?? 0) === 0 ? (
            <EmptyChart label="No leads yet" />
          ) : (
            <ul className="space-y-2.5">
              {data?.recentLeads.slice(0, 6).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/leads/${l.id}`}
                      className="block truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {l.customerName}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.assignedToName || "Unassigned"} · {formatDate(l.createdAt)}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[l.status as LeadStatus] ?? "neutral"}>
                    {LEAD_STATUS_LABELS[l.status as LeadStatus] ?? l.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      {/* GST vs Non-GST revenue — SRS 3.3. */}
      <GstRevenueChart />

      {/* My reminders — set from the Manage Lead panel, surfaced here. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <RemindersPanel />
        </div>
      </div>

      {/*
        Full status breakdown.

        Previously eleven coloured Badge pills in a row behind a decorative
        trending-up icon — every status rendered in its own colour whether or
        not it held a single lead, which is eleven competing signals and no
        hierarchy. It is now a plain definition row: label, count, aligned.
        Statuses with nothing in them are dimmed rather than dropped, so the
        list stays in a stable order you can learn the shape of.
      */}
      <div className="pg-panel divide-y divide-border">
        <div className="px-4 py-2.5 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          All statuses
        </div>
        <div className="grid grid-cols-2 gap-x-8 px-4 py-1 sm:grid-cols-3 lg:grid-cols-4">
          {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => {
            const count = data?.leadStatusMix.find((m) => m.status === s)?.count ?? 0;
            return (
              <div
                key={s}
                className={`flex items-baseline justify-between gap-3 border-b border-border/40 py-2 last:border-0 ${
                  count === 0 ? "text-muted-foreground/50" : ""
                }`}
              >
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: count === 0 ? "currentColor" : STATUS_COLORS[s] }}
                  />
                  <span className="truncate">{LEAD_STATUS_LABELS[s]}</span>
                </span>
                <span className="font-mono text-sm tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
