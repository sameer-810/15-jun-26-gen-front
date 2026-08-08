import type { LeadStatus, LeadSource, FuelType } from "../types";

/**
 * Status vocabulary — mirrors OPEN/CLOSED_LEAD_STATUSES on the backend
 * (src/modules/lead/lead.constants.js). Keep the two in step: the order here
 * is the order the dropdowns render in.
 */
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  important: "Important",
  contacted: "Contacted",
  follow_up: "Follow-up",
  quotation_sent: "Quotation Sent",
  negotiation: "Negotiation",
  other: "Other",
  deal_done: "Deal Done",
  converted: "Converted",
  not_interested: "Not Interested",
  irrelevant: "Irrelevant",
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  important: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  contacted: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  follow_up: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  quotation_sent: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  negotiation: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  other: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  deal_done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  converted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  not_interested: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  irrelevant: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

/** Dead leads — the only statuses the admin bulk-delete will remove. */
export const BULK_DELETABLE_LEAD_STATUSES: LeadStatus[] = ["not_interested", "irrelevant"];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  walk_in: "Walk-in",
  referral: "Referral",
  website: "Website",
  phone: "Phone",
  exhibition: "Exhibition",
  social_media: "Social Media",
  indiamart: "IndiaMART",
  other: "Other",
};

export const FUEL_LABELS: Record<FuelType, string> = {
  diesel: "Diesel",
  gas: "Gas",
  petrol: "Petrol",
  any: "Any",
};

export const LEAD_STATUSES = Object.keys(LEAD_STATUS_LABELS) as LeadStatus[];
export const LEAD_SOURCES = Object.keys(LEAD_SOURCE_LABELS) as LeadSource[];
export const FUEL_TYPES = Object.keys(FUEL_LABELS) as FuelType[];
