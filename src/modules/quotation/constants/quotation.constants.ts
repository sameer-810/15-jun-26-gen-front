import type { DocStatus, DocType } from "../types";

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  quotation: "Quotation",
  proforma: "Proforma Invoice",
  invoice: "Tax Invoice",
};

/** Plural forms for tab labels and page headings. */
export const DOC_TYPE_PLURALS: Record<DocType, string> = {
  quotation: "Quotations",
  proforma: "Proforma Invoices",
  invoice: "Tax Invoices",
};

export const DOC_TYPES: DocType[] = ["quotation", "proforma", "invoice"];

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
};

export const DOC_STATUS_COLORS: Record<DocStatus, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  expired: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export const DOC_STATUSES = Object.keys(DOC_STATUS_LABELS) as DocStatus[];

export const DEFAULT_TERMS = [
  "Prices are inclusive of GST as shown.",
  "50% advance along with the purchase order; balance before dispatch.",
  "Delivery within 4 weeks from receipt of confirmed order.",
  "Warranty as per manufacturer's standard terms.",
];
