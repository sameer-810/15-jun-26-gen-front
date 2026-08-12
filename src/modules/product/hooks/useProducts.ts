import { useQuery } from "@tanstack/react-query";
import { createResourceHooks } from "@/modules/common/createResourceHooks";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProductOptions,
  suggestGensets,
  getProductFacets,
} from "../api/productApi";
import type { ProductListQuery, ProductCreatePayload, ProductListResult } from "../types";

const crud = createResourceHooks<ProductListQuery, ProductCreatePayload, ProductListResult>(
  "products",
  {
    list: listProducts,
    create: createProduct,
    update: updateProduct,
    remove: deleteProduct,
  },
);

export const useProducts = crud.useList;
export const useCreateProduct = crud.useCreate;
export const useUpdateProduct = crud.useUpdate;
export const useDeleteProduct = crud.useDelete;

/**
 * Options for the quotation description combobox. Kept warm for a minute —
 * the catalog changes rarely and the box is opened on every line item.
 */
export function useProductOptions(search: string, enabled = true) {
  return useQuery({
    queryKey: ["products", "options", search],
    queryFn: () => searchProductOptions(search),
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Gensets big enough for a calculated load. Only fires once a calculation has
 * produced a kVA figure.
 */
export function useGensetSuggestions(minKva: number | null) {
  return useQuery({
    queryKey: ["products", "options", "minKva", minKva],
    queryFn: () => suggestGensets(minKva as number),
    enabled: Boolean(minKva),
    staleTime: 60_000,
  });
}

export function useProductFacets(enabled = true) {
  return useQuery({
    queryKey: ["products", "facets"],
    queryFn: getProductFacets,
    enabled,
    staleTime: 60_000,
  });
}
