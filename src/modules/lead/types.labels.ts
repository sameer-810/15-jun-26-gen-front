import type { Activity } from "@/modules/activity/types";
import type { Quotation } from "@/modules/quotation/types";
import type { Sale } from "@/modules/sale/types";
import type { Lead } from "./types";

export type LabelColor =
  | "slate"
  | "red"
  | "orange"
  | "amber"
  | "green"
  | "teal"
  | "blue"
  | "violet"
  | "pink";

export type LeadLabel = {
  id: string;
  name: string;
  color: LabelColor;
  /** How many leads currently carry this label — shown on the manage screen. */
  leadCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ReminderStatus = "pending" | "done" | "dismissed";

export type Reminder = {
  id: string;
  leadId: string | null;
  lead: { id: string; customerName?: string; mobile?: string; city?: string } | null;
  remindAt: string;
  note?: string;
  status: ReminderStatus;
  completedAt?: string;
  /** Pending and already past its time. */
  isDue: boolean;
  owner: { id: string; name?: string } | null;
  createdAt: string;
  updatedAt: string;
};

/** Counters shown on the lead card, mirroring the IndiaMART reference screen. */
export type LeadEngagement = {
  calls: number;
  messages: number;
  replies: number;
  followUps: number;
  requirements: number;
  quotations: number;
  sales: number;
};

/** Everything the lead detail screen needs, in one response. */
export type LeadWorkspace = {
  lead: Lead;
  engagement: LeadEngagement;
  timeline: Activity[];
  reminders: Reminder[];
  quotations: Quotation[];
  sales: Sale[];
};
