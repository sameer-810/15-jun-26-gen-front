import { z } from "zod";

export const inventorySchema = z.object({
  model: z.string().trim().min(1, "Model is required"),
  brand: z.string().trim().optional(),
  kva: z.coerce.number().min(0, "KVA is required"),
  fuelType: z.enum(["diesel", "gas", "petrol"]),
  phase: z.enum(["single", "three"]),
  location: z.string().trim().optional(),
  availableQuantity: z.coerce.number().int().min(0).optional(),
  lowStockThreshold: z.coerce.number().int().min(0),
  purchasePrice: z.coerce.number().min(0).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  purchaseDate: z.string().trim().optional(),
  hsnCode: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type InventoryFormValues = z.infer<typeof inventorySchema>;
