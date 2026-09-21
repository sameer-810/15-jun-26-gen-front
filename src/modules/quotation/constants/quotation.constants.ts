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

/**
 * SRF's Terms, Conditions & Declarations for the buyer, as supplied by SRF and
 * printed on every new quotation, proforma and tax invoice. SRF's legal wording
 * is kept exactly; only the spacing from the pasted original was tidied. Each
 * document stores its own copy, so changing this list never alters a document
 * that already exists.
 */
export const DEFAULT_TERMS = [
  "SUBJECT TO MUMBAI JURISDICTION ONLY.",
  "DELIVERY EX-OUR WORKS.",
  "RESPONSIBILITY CEASES AFTER GOODS ARE DESPATCHED FROM OUR PREMISES.",
  "WE ARE NOT RESPONSIBLE FOR ANY SHORTAGE & DAMAGE OF GOODS SOLD.",
  "WE SALE NEW, SEMI BRND NEW, OLD, USED, RECONDITIONED, ASSEMBLED & PREOWNED GENERATOR SETS.",
  "GOODS ARE SOLD ON “AS IS WHAT IS” & “AS IS WHERE IS BASIS” ONLY.",
  "GOODS ONCE SOLD WILL NOT BE TAKEN BACK OR EXCHANGED.",
  "ADVANCE ONCE RECEIVED WILL NOT BE REFUNDED.",
  "FREIGHT, ALL TAXES & GST TO BE PAID BY THE BUYER.",
  "NO RETURN OF PRODUCT & NO REFUND OF MONEY.",
  "ORDER ONCE PLACED CAN NOT BE CANCELLED IN ANY CIRCUMSTANCE.",
  "WE ARE NOT RESPONSIBLE TO ARRANGE THE LOAN BY THE BANK TO THE BUYER TO PURCHASE THE GENERATOR SET.",
  "WE NEITHER GIVE GUARANTEE NOR WARRANTY FOR ANY GENERATOR SET, BREAKAGE, CURRENT LOAD, LEAKAGE, WARE & TARE, SPARE PARTS, ELECTRICAL PARTS & BURNT ITEMS.",
  "I, THE BUYER, HERE BY GIVE MY CONSENT THAT IN ANY DISPUTE, THE FINAL DECISION WILL BE OF THE SELLERS ONLY & I, THE BUYER, WILL ABIDE BY THE SAME.",
  "I THE BUYER, HAVE READ, UNDERSTOOD & AGREED TO ALL THE ABOVE MENTIONED TERMS, CONDITIONED & DECLARATION.",
  "BUYER ACCEPTANCE : I, THE BUYER, HAVE SEEN, CHECKED & TESTED AND TAKEN THE PHYSICAL TRIAL OF THE GENERATOR SET & I AM TOTALLY SATISFIED WITH THE GENERATOR SET AND I HAVE NO DISPUTE.",
  "I, THE BUYER, ALSO DO AGREE. TO ALL THE ABOVE TERMS, CONDITIONS & DECLARATION BY THE SELLER.",
];
