import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBusinessProfile, getChatAppearance, updateBusinessProfile } from "../api/settingsApi";

export function useBusinessProfile() {
  return useQuery({ queryKey: ["business-profile"], queryFn: getBusinessProfile });
}

/**
 * Message appearance (SRS 3.4), for any signed-in user.
 *
 * Cached hard: it is three booleans set once by an admin, read on every lead
 * screen. Refetching it per navigation would be a request per page view for
 * data that changes twice a year.
 */
export function useChatAppearance() {
  return useQuery({
    queryKey: ["chat-appearance"],
    queryFn: getChatAppearance,
    staleTime: 30 * 60 * 1000,
  });
}

export function useUpdateBusinessProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateBusinessProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-profile"] });
      // The appearance switches live on the same document.
      qc.invalidateQueries({ queryKey: ["chat-appearance"] });
    },
  });
}
