import { useQuery } from "@tanstack/react-query";
import { getDashboardMetrics, getSalesAnalytics } from "../api/dashboardApi";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboardMetrics,
    refetchInterval: 60_000,
  });
}

/**
 * GST vs Non-GST revenue (SRS 3.3).
 *
 * A separate query rather than more fields on the dashboard payload: it spans
 * twelve months of sales, and the main dashboard refetches every minute. Paying
 * that aggregation cost sixty times an hour to draw a chart that changes when a
 * sale is recorded would be waste.
 */
export function useSalesAnalytics(months = 12) {
  return useQuery({
    queryKey: ["dashboard", "sales-analytics", months],
    queryFn: () => getSalesAnalytics(months),
    staleTime: 5 * 60 * 1000,
  });
}
