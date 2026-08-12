import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "@/shared/api/http";

/**
 * The Location master list — change request (11 Aug) point 9: "location
 * template need to add in template section so wherever location added need
 * dropdown instead of input".
 */

export type Location = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  contactPerson?: string;
  mobile?: string;
  isActive: boolean;
  /** How many inventory rows and sales point at this location. */
  usage?: { inventory: number; sales: number; total: number };
  createdAt?: string;
  updatedAt?: string;
};

export type LocationPayload = {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  contactPerson?: string;
  mobile?: string;
  isActive?: boolean;
};

async function listLocations(params: { search?: string; activeOnly?: boolean; limit?: number }) {
  const res = await http.get<{ data: Location[]; meta: { total: number } }>("/locations", {
    params,
  });
  return { items: res.data.data, meta: res.data.meta };
}

export function useLocations(
  params: { search?: string; activeOnly?: boolean; limit?: number } = { limit: 200 },
  enabled = true,
) {
  return useQuery({
    queryKey: ["locations", params],
    queryFn: () => listLocations(params),
    enabled,
    staleTime: 60_000,
  });
}

function useLocationInvalidator() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["locations"] });
    // A rename rewrites the location stamped on stock and sales.
    qc.invalidateQueries({ queryKey: ["inventory"] });
    qc.invalidateQueries({ queryKey: ["sales"] });
  };
}

export function useCreateLocation() {
  const invalidate = useLocationInvalidator();
  return useMutation({
    mutationFn: async (payload: LocationPayload) => {
      const res = await http.post<{ data: Location }>("/locations", payload);
      return res.data.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateLocation() {
  const invalidate = useLocationInvalidator();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<LocationPayload> }) => {
      const res = await http.patch<{ data: Location }>(`/locations/${id}`, payload);
      return res.data.data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteLocation() {
  const invalidate = useLocationInvalidator();
  return useMutation({
    mutationFn: (id: string) => http.delete(`/locations/${id}`).then(() => undefined),
    onSuccess: invalidate,
  });
}

/** Backfill the master list from locations already typed as free text. */
export function useSeedLocations() {
  const invalidate = useLocationInvalidator();
  return useMutation({
    mutationFn: async () => {
      const res = await http.post<{ data: { found: number; created: number } }>("/locations/seed");
      return res.data.data;
    },
    onSuccess: invalidate,
  });
}
