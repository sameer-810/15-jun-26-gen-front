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
  id: string;
  userId: string;
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
  pay: {
    monthlyGross: number;
    daysInMonth: number;
    dayRate: number;
    payableDays: number;
    grossEarned: number;
    counts: Partial<Record<AttendanceStatus, number>>;
    unresolvedDays: number;
    overtimeMinutes: number;
  };
  incentive: {
    incentiveRate: number;
    salesValue: number;
    incentiveEarned: number;
    unitsSold: number;
  };
  targets: TargetRow[];
  totalEarned: number;
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
