export type MediaKind = "image" | "pdf" | "excel" | "doc" | "video" | "other";

export type UserRef = { id: string; name?: string } | null;

export type Media = {
  id: string;
  filename: string;
  mimeType: string;
  kind: MediaKind;
  sizeBytes: number;
  url: string;
  thumbnailUrl: string;
  width?: number;
  height?: number;
  provider: string;
  categories: string[];
  productId?: string | null;
  caption?: string;
  uploadedBy: UserRef;
  createdAt: string;
  updatedAt: string;
};

export type MediaListQuery = {
  search?: string;
  kind?: MediaKind;
  category?: string;
  productId?: string;
  page: number;
  limit: number;
};

export type MediaListResult = {
  items: Media[];
  meta: {
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    page: number;
    limit: number;
  };
};

/** Category/kind counts plus the active storage config, for the picker rail. */
export type MediaFacets = {
  categories: { category: string; count: number }[];
  kinds: { kind: MediaKind; count: number }[];
  provider: string;
  maxUploadMb: number;
};

export type MediaUpdatePayload = {
  filename?: string;
  caption?: string;
  categories?: string | string[];
  productId?: string;
};
