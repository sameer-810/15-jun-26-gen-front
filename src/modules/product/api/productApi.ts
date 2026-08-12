import { http } from "@/shared/api/http";
import { createResourceApi } from "@/modules/common/createResourceApi";
import type {
  Product,
  ProductListQuery,
  ProductCreatePayload,
  ProductOption,
  ProductFacets,
} from "../types";

const api = createResourceApi<Product, ProductListQuery, ProductCreatePayload>("/products");

export const listProducts = (query: ProductListQuery) => api.list(query);
export const createProduct = (payload: ProductCreatePayload) => api.create(payload);
export const updateProduct = (id: string, payload: Partial<ProductCreatePayload>) =>
  api.update(id, payload);
export const deleteProduct = (id: string) => api.remove(id);

/** Compact search used by the quotation line-item combobox (point 4). */
export async function searchProductOptions(search: string, limit = 20): Promise<ProductOption[]> {
  const res = await http.get<{ data: ProductOption[] }>("/products/options", {
    params: { search: search || undefined, limit },
  });
  return res.data.data;
}

/**
 * Catalog gensets rated at or above a calculated load, smallest first — the
 * calculator's hand-off to a quotation (point 4, "first calculate then quote").
 */
export async function suggestGensets(minKva: number, limit = 4): Promise<ProductOption[]> {
  const res = await http.get<{ data: ProductOption[] }>("/products/options", {
    params: { minKva, limit },
  });
  return res.data.data;
}

export async function getProductFacets(): Promise<ProductFacets> {
  const res = await http.get<{ data: ProductFacets }>("/products/facets");
  return res.data.data;
}

export async function importProducts(fileBase64: string) {
  const res = await http.post<{
    data: { created: number; skipped: number; total: number };
  }>("/products/import", { fileBase64 });
  return res.data.data;
}

/**
 * Copy the models already held in Inventory into the catalog, so the quotation
 * description dropdown is useful without re-typing the stock list (point 4).
 */
export async function seedCatalogFromInventory() {
  const res = await http.post<{
    data: { found: number; created: number; skipped: number };
  }>("/products/seed-from-inventory");
  return res.data.data;
}

export const productExportPath = "/products/export";
