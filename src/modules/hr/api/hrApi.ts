import { http } from "@/shared/api/http";

/** How a day was settled. See the backend model for what each threshold means. */
export type AttendanceStatus =
  | "present"
  | "half_day"
  | "absent"
  | "incomplete"
  | "leave"
  | "week_off";

export type Punch = {
  at: string;
  photoUrl: string | null;
  lat: number | null;
  lng: number | null;
  isManual: boolean;
  manualReason: string | null;
};

export type AttendanceDay = {
  /**
   * Null for a calendar-supplied day with no database row — an unpunched Sunday
   * or absence. It still counts towards pay, but there is nothing to open.
   */
  id: string | null;
  userId: string | null;
  isSynthetic?: boolean;
  userName: string;
  date: string;
  firstIn: Punch | null;
  lastOut: Punch | null;
  punchCount: number;
  workedMinutes: number;
  status: AttendanceStatus;
  note: string | null;
  resolvedAt: string | null;
};

export type TodayState = {
  date: string;
  attendance: AttendanceDay | null;
  isPunchedIn: boolean;
  punchCount: number;
};

export type TargetRow = {
  id: string;
  userId: string;
  userName: string;
  metric: "sales_value" | "conversions";
  target: number;
  achieved: number;
  percent: number;
  note: string | null;
};

export type MonthlyPerformance = {
  employee: { id: string; name: string; role: string; joiningDate: string | null };
  period: { month: string; from: string; to: string; daysInMonth: number };
  days: AttendanceDay[];
  /**
   * False when the reader may see attendance but not the money — a manager
   * viewing someone else. Salary is admin-or-your-own, as on /auth/users. The
   * pay fields are then absent rather than zeroed: a zero reads as "earned
   * nothing", which is worse than saying nothing.
   */
  payVisible: boolean;
  pay: {
    daysInMonth: number;
    payableDays: number;
    counts: Partial<Record<AttendanceStatus, number>>;
    unresolvedDays: number;
    overtimeMinutes: number;
    // Present only when payVisible.
    monthlyGross?: number;
    dayRate?: number;
    grossEarned?: number;
  };
  incentive: {
    unitsSold: number;
    // Present only when payVisible.
    incentiveRate?: number;
    salesValue?: number;
    incentiveEarned?: number;
  };
  targets: TargetRow[];
  /** Present only when payVisible. */
  totalEarned?: number;
};

export async function punch(payload: {
  photoBase64: string;
  lat?: number;
  lng?: number;
  accuracyM?: number;
}) {
  const res = await http.post<{
    data: { attendance: AttendanceDay; direction: "in" | "out" };
    message: string;
  }>("/attendance/punch", payload);
  return res.data.data;
}

export async function getToday() {
  const res = await http.get<{ data: TodayState }>("/attendance/today");
  return res.data.data;
}

export async function listAttendance(params: {
  userId?: string;
  from?: string;
  to?: string;
  status?: AttendanceStatus;
  page?: number;
  limit?: number;
}) {
  const res = await http.get<{
    data: AttendanceDay[];
    meta: { total: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean };
  }>("/attendance", { params });
  return { items: res.data.data, meta: res.data.meta };
}

export async function resolveDay(id: string, payload: { outAt: string; note?: string }) {
  const res = await http.patch<{ data: AttendanceDay }>(`/attendance/${id}/resolve`, payload);
  return res.data.data;
}

/** Mark a range as approved leave. `to` is optional. Worked days come back in `skipped`. */
export async function markLeave(payload: {
  userId: string;
  from: string;
  to?: string;
  note?: string;
}) {
  const res = await http.post<{
    data: { marked: number; skipped: number };
    message: string;
  }>("/attendance/leave", payload);
  return { ...res.data.data, message: res.data.message };
}

export async function clearLeave(payload: { userId: string; date: string }) {
  await http.delete("/attendance/leave", { data: payload });
}

export async function getMonthly(params: { userId?: string; month?: string }) {
  const res = await http.get<{ data: MonthlyPerformance }>("/attendance/monthly", { params });
  return res.data.data;
}

export async function listTargets(params: { userId?: string; month?: string }) {
  const res = await http.get<{
    data: { period: { month: string }; targets: TargetRow[] };
  }>("/targets", { params });
  return res.data.data;
}

export async function setTarget(payload: {
  userId: string;
  month: string;
  metric: "sales_value" | "conversions";
  value: number;
  note?: string;
}) {
  const res = await http.post<{ data: TargetRow }>("/targets", payload);
  return res.data.data;
}

export async function deleteTarget(id: string) {
  await http.delete(`/targets/${id}`);
}
