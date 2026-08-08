import { http } from "@/shared/api/http";
import type {
  Media,
  MediaFacets,
  MediaListQuery,
  MediaListResult,
  MediaUpdatePayload,
} from "../types";

export async function listMedia(query: MediaListQuery): Promise<MediaListResult> {
  const res = await http.get<{ data: Media[]; meta: MediaListResult["meta"] }>("/media", {
    params: query,
  });
  return { items: res.data.data, meta: res.data.meta };
}

export async function getMediaFacets(): Promise<MediaFacets> {
  const res = await http.get<{ data: MediaFacets }>("/media/facets");
  return res.data.data;
}

/**
 * Upload a single file as multipart/form-data. The Content-Type header is left
 * to the browser so it can set the multipart boundary itself.
 */
export async function uploadMedia(
  file: File,
  meta: { categories?: string; caption?: string; productId?: string } = {},
): Promise<Media> {
  const form = new FormData();
  form.append("file", file);
  if (meta.categories) form.append("categories", meta.categories);
  if (meta.caption) form.append("caption", meta.caption);
  if (meta.productId) form.append("productId", meta.productId);

  // Uploads travel further than a JSON call (browser → API → Cloudinary), so
  // the client default of 20s is too tight for a 10 MB file on a slow line.
  const res = await http.post<{ data: Media }>("/media", form, { timeout: 120_000 });
  return res.data.data;
}

export async function updateMedia(id: string, payload: MediaUpdatePayload): Promise<Media> {
  const res = await http.patch<{ data: Media }>(`/media/${id}`, payload);
  return res.data.data;
}

export async function deleteMedia(id: string): Promise<void> {
  await http.delete(`/media/${id}`);
}
