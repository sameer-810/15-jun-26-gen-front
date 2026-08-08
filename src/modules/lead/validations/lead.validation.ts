import { z } from "zod";

export const leadSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required"),
  mobile: z.string().trim().optional(),
  alternateMobile: z.string().trim().optional(),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  requirement: z.string().trim().optional(),
  requiredKva: z.coerce.number().min(0).optional(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  fuelType: z.enum(["diesel", "gas", "petrol", "any"]),
  estimatedValue: z.coerce.number().min(0).optional(),
  source: z.enum([
    "walk_in",
    "referral",
    "website",
    "phone",
    "exhibition",
    "social_media",
    "indiamart",
    "other",
  ]),
  status: z.enum([
    "new",
    "important",
    "contacted",
    "follow_up",
    "quotation_sent",
    "negotiation",
    "other",
    "deal_done",
    "converted",
    "not_interested",
    "irrelevant",
  ]),
  assignedTo: z.string().optional(),
  lostReason: z.string().trim().optional(),
  nextFollowUpDate: z.string().trim().optional(),
});

export type LeadFormValues = z.infer<typeof leadSchema>;
