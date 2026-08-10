import type { Media } from "@/modules/media/types";

export type ProductFuelType = "diesel" | "gas" | "petrol" | "other";
export type ProductPhase = "single" | "three";

export type ProductSpec = { label: string; value: string };

/**
 * Exactly what the quotation line-item combobox writes into a row when a
 * product is picked (Change Request point 4). Computed server-side so the
 * auto-fill rule lives in one place.
 */
export type QuotationDefaults = {
  description: string;
  model: string;
  kva?: number;
  hsnCode: string;
  unitPrice: number;
  taxRate: number;
};

export type Product = {
  id: string;
  name: string;
  brand?: string;
  modelCode?: string;
  kva?: number;
  fuelType: ProductFuelType;
  phase: ProductPhase;
  hsnCode?: string;
  unit?: string;
  price: number;
  taxRate: number;
  shortDescription: string;
  longDescription: string;
  specs: ProductSpec[];
  images: Media[];
  primaryImageUrl?: string | null;
  categories: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  quotationDefaults: QuotationDefaults;
};

/** Compact shape returned by /products/options for the combobox. */
export type ProductOption = {
  id: string;
  name: string;
  brand?: string;
  modelCode?: string;
  kva?: number;
  price: number;
  unit?: string;
  primaryImageUrl?: string | null;
  /** Snapshotted onto the quotation line so the PDF can print the spec block. */
  specs: ProductSpec[];
  quotationDefaults: QuotationDefaults;
};

export type ProductListQuery = {
  search?: string;
  brand?: string;
  fuelType?: ProductFuelType;
  category?: string;
  activeOnly?: boolean;
  page: number;
  limit: number;
};

export type ProductListResult = {
  items: Product[];
  meta: {
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    page: number;
    limit: number;
  };
};

export type ProductCreatePayload = {
  name: string;
  brand?: string;
  modelCode?: string;
  kva?: number;
  fuelType?: ProductFuelType;
  phase?: ProductPhase;
  hsnCode?: string;
  unit?: string;
  price?: number;
  taxRate?: number;
  shortDescription?: string;
  longDescription?: string;
  specs?: ProductSpec[];
  imageIds?: string[];
  categories?: string | string[];
  isActive?: boolean;
};

export type ProductFacets = {
  categories: { category: string; count: number }[];
};
