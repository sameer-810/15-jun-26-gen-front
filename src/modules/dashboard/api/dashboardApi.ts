import { http } from "@/shared/api/http";

export type LeadStatusMixPoint = { status: string; count: number };
export type MonthlyLeadPoint = { month: string; label: string; leads: number; converted: number };
export type TopModel = { model: string; units: number; value: number };

export type DashboardMetrics = {
  leads: { total: number; new: number; inProgress: number; converted: number; lost: number };
  pipeline: { openValue: number; openCount: number };
  conversionRate: number;
  sales: { totalUnits: number; totalValue: number; thisMonthValue: number };
  inventory: { models: number; available: number; sold: number; lowStock: number };
  followUps: { dueToday: number; overdue: number };
  /** Reminders I own that are due now or overdue. */
  remindersDue: number;
  totalUsers: number;
  monthlyLeadTrend: MonthlyLeadPoint[];
  leadStatusMix: LeadStatusMixPoint[];
  topModels: TopModel[];
  recentLeads: Array<{
    id: string;
    customerName: string;
    status: string;
    requirement?: string;
    assignedToName?: string | null;
    createdAt: string;
  }>;
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const res = await http.get<{ data: DashboardMetrics }>("/dashboard");
  return res.data.data;
}
