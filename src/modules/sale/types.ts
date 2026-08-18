export type UserRef = { id: string; name?: string } | null;

/**
 * How a sale was billed (SRS 3.3). `unclassified` is what rows recorded before
 * this field existed carry — it is a real state, not a missing value, and the
 * analytics chart shows it as its own band rather than guessing.
 */
export type GstTreatment = "gst" | "non_gst" | "unclassified";

export type Sale = {
  id: string;
  saleDate: string;
  inventoryId?: string | null;
  modelName: string;
  brand?: string;
  kva?: number;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  /** Branch/godown the units were dispatched from. */
  location?: string;
  customerName: string;
  customerMobile?: string;
  leadId?: string | null;
  salesExecutive: UserRef;
  salesExecutiveName?: string;
  gstTreatment?: GstTreatment;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type SaleListQuery = {
  search?: string;
  salesExecutive?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  minQuantity?: number;
  maxQuantity?: number;
  page: number;
  limit: number;
};

export type SaleListResult = {
  items: Sale[];
  meta: {
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    page: number;
    limit: number;
  };
};

export type SaleCreatePayload = {
  inventoryId?: string;
  modelName?: string;
  brand?: string;
  kva?: number;
  quantity: number;
  unitPrice: number;
  location?: string;
  saleDate?: string;
  customerName: string;
  customerMobile?: string;
  /** How the sale is billed (SRS 3.3). Omitted leaves it unclassified. */
  gstTreatment?: GstTreatment;
  notes?: string;
};
