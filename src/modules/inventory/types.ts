export type FuelType = "diesel" | "gas" | "petrol";
export type Phase = "single" | "three";
export type StockStatus = "in_stock" | "low" | "out";

export type Inventory = {
  id: string;
  model: string;
  brand?: string;
  kva: number;
  fuelType: FuelType;
  phase: Phase;
  /** Branch/godown holding this stock. */
  location?: string;
  availableQuantity: number;
  soldQuantity: number;
  totalQuantity: number;
  lowStockThreshold: number;
  stockStatus: StockStatus;
  purchasePrice: number;
  sellingPrice: number;
  purchaseDate?: string;
  hsnCode?: string;
  serialNumbers: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type InventoryListQuery = {
  search?: string;
  fuelType?: FuelType;
  lowStock?: boolean;
  location?: string;
  /** Bounds on units currently available. */
  minQuantity?: number;
  maxQuantity?: number;
  /** Added-on window (inclusive IST days). */
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
};

export type InventoryListResult = {
  items: Inventory[];
  meta: {
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    page: number;
    limit: number;
  };
};

export type InventoryCreatePayload = {
  model: string;
  brand?: string;
  kva: number;
  fuelType?: FuelType;
  phase?: Phase;
  location?: string;
  availableQuantity?: number;
  lowStockThreshold?: number;
  purchasePrice?: number;
  sellingPrice?: number;
  purchaseDate?: string;
  hsnCode?: string;
  notes?: string;
};
