import { Wallet, IndianRupee, Percent, CalendarClock, RefreshCw, TrendingUp } from "lucide-react";
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
import { useDashboard } from "../hooks/useDashboard";
import { RemindersPanel } from "@/modules/lead/components/RemindersPanel";
import { useAppSelector } from "@/app/hooks";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatCard } from "@/shared/components/StatCard";
import { Badge } from "@/shared/components/Badge";
import { LEAD_STATUS_LABELS } from "@/modules/lead/constants/lead.constants";
import type { LeadStatus } from "@/modules/lead/types";

const AMBER = "#F5A623";
const GREEN = "#16A34A";
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
        <span className="pg-nums text-2xl font-bold pg-gradient-text">{conversionRate}%</span>
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
      {/* Gradient hero */}
      <div className="pg-glow relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome back
              {user?.name ? (
                <>
                  , <span className="pg-gradient-text">{user.name.split(" ")[0]}</span>
                </>
              ) : null}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              · your generator business at a glance
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Headline KPIs — 2 leading + 2 lagging (5–7 KPI guidance) */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Wallet}
            tone="primary"
            label="Open Pipeline"
            value={formatCurrency(data?.pipeline.openValue ?? 0)}
            hint={`${data?.pipeline.openCount ?? 0} active leads · leading`}
          />
          <StatCard
            icon={CalendarClock}
            tone="warning"
            label="Follow-ups Due"
            value={data?.followUps.dueToday ?? 0}
            hint={`${data?.followUps.overdue ?? 0} overdue · leading`}
          />
          <StatCard
            icon={Percent}
            tone="success"
            label="Conversion Rate"
            value={`${data?.conversionRate ?? 0}%`}
            hint={`${data?.leads.converted ?? 0}/${data?.leads.total ?? 0} leads · lagging`}
          />
          <StatCard
            icon={IndianRupee}
            tone="info"
            label="Sales This Month"
            value={formatCurrency(data?.sales.thisMonthValue ?? 0)}
            hint={`${data?.sales.totalUnits ?? 0} units all-time · lagging`}
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

      {/* My reminders — set from the Manage Lead panel, surfaced here. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <RemindersPanel />
        </div>
      </div>

      {/* Status legend chips */}
      <div className="flex flex-wrap items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => (
          <Badge key={s} tone={STATUS_TONE[s]}>
            {LEAD_STATUS_LABELS[s]}: {data?.leadStatusMix.find((m) => m.status === s)?.count ?? 0}
          </Badge>
        ))}
      </div>
    </div>
  );
}
