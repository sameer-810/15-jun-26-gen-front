export type DocType = "quotation" | "proforma";
export type DocStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export type QuotationItem = {
  description: string;
  model?: string;
  kva?: number;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  taxRate?: number;
  taxableAmount?: number;
  taxAmount?: number;
  total?: number;
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
  isInterState: boolean;
  items: QuotationItem[];
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
  salesExecutive: { id: string; name?: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type QuotationListQuery = {
  search?: string;
  docType?: DocType;
  status?: DocStatus;
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
  isInterState?: boolean;
  items: QuotationItemPayload[];
  terms?: string[];
  notes?: string;
  status?: DocStatus;
};
