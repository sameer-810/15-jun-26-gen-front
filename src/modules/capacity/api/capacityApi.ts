import { http } from "@/shared/api/http";
import type { AppliancePreset, CapacityRequest, CapacityResult } from "../types";

export async function calculateCapacity(payload: CapacityRequest) {
  const res = await http.post<{ data: CapacityResult }>("/capacity/calculate", payload);
  return res.data.data;
}

/** The reference application chart that backs the appliance picker. */
export async function getAppliancePresets() {
  const res = await http.get<{ data: { groups: string[]; items: AppliancePreset[] } }>(
    "/capacity/presets",
  );
  return res.data.data;
}
