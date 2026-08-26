import { useMutation, useQuery } from "@tanstack/react-query";
import { calculateCapacity, getAppliancePresets } from "../api/capacityApi";

export function useCalculateCapacity() {
  return useMutation({ mutationFn: calculateCapacity });
}

/** The appliance chart. Static for the session, so cached hard. */
export function useAppliancePresets() {
  return useQuery({
    queryKey: ["capacity", "presets"],
    queryFn: getAppliancePresets,
    staleTime: Infinity,
  });
}
