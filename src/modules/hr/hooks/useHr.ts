import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  punch,
  getToday,
  listAttendance,
  resolveDay,
  getMonthly,
  listTargets,
  setTarget,
  deleteTarget,
  type AttendanceStatus,
} from "../api/hrApi";

export function useToday() {
  return useQuery({ queryKey: ["attendance", "today"], queryFn: getToday });
}

export function usePunch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: punch,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      // The punch closes a day, which changes the month's payable days.
      qc.invalidateQueries({ queryKey: ["performance"] });
    },
  });
}

export function useAttendance(params: {
  userId?: string;
  from?: string;
  to?: string;
  status?: AttendanceStatus;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["attendance", "list", params],
    queryFn: () => listAttendance(params),
  });
}

export function useResolveDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...rest }: { id: string; outAt: string; note?: string }) =>
      resolveDay(id, rest),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["performance"] });
    },
  });
}

/**
 * One month of everything for one person: attendance, pay, incentive, targets.
 *
 * The same hook backs both the employee's own "My Performance" screen and the
 * admin's view of that employee — which is how SRS 3.5's "must mirror exactly
 * what the Admin sees" is kept true. There is one endpoint and one shape; the
 * server decides whose data comes back.
 */
export function usePerformance(params: { userId?: string; month?: string }) {
  return useQuery({
    queryKey: ["performance", params],
    queryFn: () => getMonthly(params),
  });
}

export function useTargets(params: { userId?: string; month?: string }) {
  return useQuery({ queryKey: ["targets", params], queryFn: () => listTargets(params) });
}

export function useSetTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setTarget,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["targets"] });
      qc.invalidateQueries({ queryKey: ["performance"] });
    },
  });
}

export function useDeleteTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTarget,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["targets"] });
      qc.invalidateQueries({ queryKey: ["performance"] });
    },
  });
}
