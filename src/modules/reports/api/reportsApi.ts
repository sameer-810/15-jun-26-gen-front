import { http } from "@/shared/api/http";

export type ReportName = "sales" | "leads" | "inventory" | "follow-ups" | "call-activity";

export type ReportResult = {
  rows: Array<Record<string, string | number>>;
  summary: Record<string, unknown>;
};

export async function getReport(
  name: ReportName,
  params: { startDate?: string; endDate?: string },
) {
  const res = await http.get<{ data: ReportResult }>(`/reports/${name}`, { params });
  return res.data.data;
}

export const reportExportPath = (
  name: ReportName,
  params: { startDate?: string; endDate?: string },
) => {
  const q = new URLSearchParams();
  if (params.startDate) q.set("startDate", params.startDate);
  if (params.endDate) q.set("endDate", params.endDate);
  const qs = q.toString();
  return `/reports/${name}/export${qs ? `?${qs}` : ""}`;
};
