export type ApplianceCategory =
  | "lighting"
  | "fan"
  | "ac"
  | "motor"
  | "pump"
  | "refrigeration"
  | "heating"
  | "other";

export type ApplianceInput = {
  category: ApplianceCategory;
  name?: string;
  quantity: number;
  watts: number;
  /** Explicit surge draw. Wins over startingFactor and the category default. */
  startingWatts?: number;
  startingFactor?: number;
};

/** One row of the reference application chart. */
export type AppliancePreset = {
  name: string;
  group: string;
  category: ApplianceCategory;
  runningWatts: number;
  startingWatts: number;
  surgeFactor: number;
};

export type CapacityRequest = {
  appliances: ApplianceInput[];
  powerFactor?: number;
  safetyMarginPct?: number;
};

export type CapacityResultItem = {
  category: ApplianceCategory;
  name: string;
  quantity: number;
  watts: number;
  runningWatts: number;
  startingWatts: number;
  startingFactor: number;
  surgeWatts: number;
};

export type CapacityResult = {
  inputs: { powerFactor: number; safetyMarginPct: number };
  items: CapacityResultItem[];
  runningWatts: number;
  peakWatts: number;
  surgeContributor: string | null;
  runningKva: number;
  peakKva: number;
  /** The client spec's alternative sizing, shown alongside ours for comparison. */
  peakKvaNoMargin: number;
  recommendedKva: number;
  recommendedStandardKva: number;
  recommendation: string;
};
