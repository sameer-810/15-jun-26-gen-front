import type { ProductFuelType, ProductPhase } from "../types";

/**
 * The spec labels used by the sample quotation PDF the client shared
 * (Change Request point 16). New products are seeded with these rows so the
 * catalog is filled in a consistent shape.
 * Mirrors DEFAULT_SPEC_LABELS in the backend product model.
 */
export const DEFAULT_SPEC_LABELS = [
  "Power",
  "Condition",
  "Engine Brand",
  "Rated Power",
  "Fuel Type",
  "Brand",
  "Cooling System",
  "Frequency",
  "Noise Level",
  "Phase",
  "Voltage",
  "Genset Type",
];

export const PRODUCT_FUEL_LABELS: Record<ProductFuelType, string> = {
  diesel: "Diesel",
  gas: "Gas",
  petrol: "Petrol",
  other: "Other",
};

export const PRODUCT_PHASE_LABELS: Record<ProductPhase, string> = {
  single: "Single Phase",
  three: "Three Phase",
};

export const PRODUCT_FUEL_TYPES = Object.keys(PRODUCT_FUEL_LABELS) as ProductFuelType[];
