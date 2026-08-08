import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMedia, getMediaFacets, uploadMedia, updateMedia, deleteMedia } from "../api/mediaApi";
import type { MediaListQuery, MediaUpdatePayload } from "../types";

const KEYS = {
  all: ["media"] as const,
  lists: () => [...KEYS.all, "list"] as const,
  list: (q: MediaListQuery) => [...KEYS.lists(), q] as const,
  facets: () => [...KEYS.all, "facets"] as const,
};

export function useMediaList(query: MediaListQuery, enabled = true) {
  return useQuery({
    queryKey: KEYS.list(query),
    queryFn: () => listMedia(query),
    enabled,
  });
}

export function useMediaFacets(enabled = true) {
  return useQuery({
    queryKey: KEYS.facets(),
    queryFn: getMediaFacets,
    enabled,
    staleTime: 60_000,
  });
}

export function useUploadMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      categories,
      caption,
      productId,
    }: {
      file: File;
      categories?: string;
      caption?: string;
      productId?: string;
    }) => uploadMedia(file, { categories, caption, productId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useUpdateMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MediaUpdatePayload }) =>
      updateMedia(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMedia(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      // A deleted file may have been a product's primary image.
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
