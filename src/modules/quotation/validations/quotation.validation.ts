import { z } from "zod";

export const quotationItemSchema = z.object({
  description: z.string().trim().min(1, "Required"),
  model: z.string().trim().optional(),
  kva: z.coerce.number().min(0).optional(),
  hsnCode: z.string().trim().optional(),
  quantity: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  taxRate: z.coerce.number().min(0).max(100),
  unit: z.string().trim().optional(),
  // Catalog snapshot, carried through so the PDF can print the product image
  // and spec block. Set by the product picker, not typed by hand.
  product: z.string().optional(),
  imageUrl: z.string().optional(),
  specs: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
});

export const quotationSchema = z.object({
  docType: z.enum(["quotation", "proforma", "invoice"]),
  date: z.string().trim().optional(),
  validUntil: z.string().trim().optional(),
  customerName: z.string().trim().min(1, "Customer name is required"),
  customerMobile: z.string().trim().optional(),
  customerEmail: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  customerAddress: z.string().trim().optional(),
  customerGstin: z.string().trim().optional(),
  customerState: z.string().trim().optional(),
  shipToSameAsBilling: z.boolean(),
  shipToName: z.string().trim().optional(),
  shipToAddress: z.string().trim().optional(),
  shipToGstin: z.string().trim().optional(),
  shipToState: z.string().trim().optional(),
  shipToContactPerson: z.string().trim().optional(),
  shipToMobile: z.string().trim().optional(),
  isInterState: z.boolean(),
  items: z.array(quotationItemSchema).min(1, "Add at least one line item"),
  termsText: z.string().optional(),
  notes: z.string().trim().optional(),
});

export type QuotationFormValues = z.infer<typeof quotationSchema>;
