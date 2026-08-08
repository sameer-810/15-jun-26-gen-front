import { z } from "zod";

/**
 * A spec row in the *form*. New products are seeded with the standard labels
 * and no values, so a fully-blank or label-only row is legitimate scaffolding
 * that onSubmit filters out — requiring both fields here made the dialog
 * silently unsubmittable until all twelve seeded rows were filled or deleted.
 *
 * A row is only invalid when it is half-filled, which is a genuine mistake.
 * The API schema still requires both fields for the rows actually sent.
 */
export const productSpecSchema = z
  .object({
    label: z.string().trim().max(60),
    value: z.string().trim().max(200),
  })
  .refine((s) => !(s.value.length > 0 && s.label.length === 0), {
    message: "Add a label for this value",
    path: ["label"],
  });

export const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(200),
  brand: z.string().trim().max(100).optional(),
  modelCode: z.string().trim().max(100).optional(),
  kva: z.coerce.number().min(0).optional(),
  fuelType: z.enum(["diesel", "gas", "petrol", "other"]),
  phase: z.enum(["single", "three"]),
  hsnCode: z.string().trim().max(20).optional(),
  unit: z.string().trim().max(30).optional(),
  price: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100),
  shortDescription: z.string().trim().max(500).optional(),
  // Unbounded — the client's sample description is a dozen lines long.
  longDescription: z.string().optional(),
  specs: z.array(productSpecSchema).max(40),
  categoriesText: z.string().optional(),
  isActive: z.boolean(),
});

export type ProductFormValues = z.infer<typeof productSchema>;
