export type DocType = "quotation" | "proforma" | "invoice";
export type DocStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export type ProductSpecLine = { label: string; value: string };

export type QuotationItem = {
  description: string;
  model?: string;
  kva?: number;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  taxRate?: number;
  unit?: string;
  /** Catalog snapshot — copied at creation so an issued doc never changes. */
  productId?: string | null;
  imageUrl?: string;
  specs?: ProductSpecLine[];
  taxableAmount?: number;
  taxAmount?: number;
  total?: number;
};

/** Per-HSN tax breakup printed at the foot of a tax invoice (GSTR-1). */
export type HsnSummaryRow = {
  hsnCode: string;
  quantity: number;
  taxableValue: number;
  taxRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
};

export type Quotation = {
  id: string;
  docType: DocType;
  docNumber: number;
  docNumberFormatted: string;
  date: string;
  validUntil?: string;
  leadId?: string | null;
  customerName: string;
  customerMobile?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerGstin?: string;
  customerState?: string;
  shipToSameAsBilling: boolean;
  shipToName?: string;
  shipToAddress?: string;
  shipToGstin?: string;
  shipToState?: string;
  shipToContactPerson?: string;
  shipToMobile?: string;
  financialYear?: string;
  isInterState: boolean;
  items: QuotationItem[];
  hsnSummary: HsnSummaryRow[];
  subTotal: number;
  totalDiscount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
  terms: string[];
  notes?: string;
  status: DocStatus;
  /** An issued tax invoice is immutable — no edits, no deletion. */
  isIssued: boolean;
  issuedAt?: string;
  sourceDocId?: string | null;
  salesExecutive: { id: string; name?: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type QuotationListQuery = {
  search?: string;
  docType?: DocType;
  status?: DocStatus;
  /** Restrict to documents raised for one lead. */
  lead?: string;
  page: number;
  limit: number;
};

export type QuotationListResult = {
  items: Quotation[];
  meta: {
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    page: number;
    limit: number;
  };
};

export type QuotationItemPayload = {
  description: string;
  model?: string;
  kva?: number;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  taxRate?: number;
  unit?: string;
  product?: string;
  imageUrl?: string;
  specs?: ProductSpecLine[];
};

/**
 * Seed values for a brand-new document raised from somewhere else in the CRM
 * (today: the "Quote" button on a lead row). Deliberately a plain shape rather
 * than a Lead, so the quotation module stays independent of the lead module.
 */
export type QuotationPrefill = {
  customerName: string;
  customerMobile?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerState?: string;
  /** Becomes the first line item's description. */
  description?: string;
  kva?: number;
  quantity?: number;
  unitPrice?: number;
};

export type QuotationCreatePayload = {
  docType: DocType;
  date?: string;
  validUntil?: string;
  customerName: string;
  customerMobile?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerGstin?: string;
  customerState?: string;
  shipToSameAsBilling?: boolean;
  shipToName?: string;
  shipToAddress?: string;
  shipToGstin?: string;
  shipToState?: string;
  shipToContactPerson?: string;
  shipToMobile?: string;
  isInterState?: boolean;
  items: QuotationItemPayload[];
  terms?: string[];
  notes?: string;
  status?: DocStatus;
};

/** Last billing/shipping block used for a customer — point 6's "auto fetch". */
export type CustomerLookup = {
  sourceDocNumber: string;
  customerName: string;
  customerMobile?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerGstin?: string;
  customerState?: string;
  shipToSameAsBilling: boolean;
  shipToName?: string;
  shipToAddress?: string;
  shipToGstin?: string;
  shipToState?: string;
  shipToContactPerson?: string;
  shipToMobile?: string;
  isInterState: boolean;
};
