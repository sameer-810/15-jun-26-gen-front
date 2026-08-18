import { http } from "@/shared/api/http";

export type BusinessProfile = {
  businessName: string;
  tagline?: string;
  gstin?: string;
  officeAddress?: string;
  serviceCenterAddress?: string;
  mobileNumbers?: string[];
  email?: string;
  website?: string;
  jurisdiction?: string;
  defaultCgstRate?: number;
  defaultSgstRate?: number;
  defaultIgstRate?: number;
  /**
   * Document numbering (SRS 3.3). Each series is a prefix plus the next number
   * to be issued. Quotations and proformas run a simple counter; the tax
   * invoice series additionally resets every financial year, which is a
   * statutory requirement and so is not editable here.
   */
  quotationPrefix?: string;
  nextQuotationNumber?: number;
  proformaPrefix?: string;
  nextProformaNumber?: number;
  invoicePrefix?: string;
  nextInvoiceNumber?: number;
  /** Read-only — the FY the invoice counter currently belongs to. */
  invoiceSeriesFy?: string;

  /**
   * Message composer appearance (SRS 3.4).
   *
   * Business-wide rather than per-user on purpose: the product was rejected for
   * looking inconsistent, and per-user dialog theming would rebuild exactly
   * that. See DECISIONS.md Q4.
   */
  chatDensity?: "comfortable" | "compact";
  chatAccentOutgoing?: boolean;
  chatShowTimestamps?: boolean;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  defaultTerms?: string[];
  /** Letterhead artwork rendered on generated PDFs (point 6). */
  letterheadHeaderUrl?: string;
  letterheadFooterUrl?: string;
  signatureUrl?: string;
  closingLines?: string[];
};

export type ChatAppearance = {
  chatDensity: "comfortable" | "compact";
  chatAccentOutgoing: boolean;
  chatShowTimestamps: boolean;
};

/**
 * The message-appearance switches, readable by every signed-in user.
 *
 * Separate from `getBusinessProfile` because that one is admin-only — it
 * carries the bank account and GSTIN, and a sales exec needs three booleans to
 * render a conversation, not the company's banking details.
 */
export async function getChatAppearance() {
  const res = await http.get<{ data: ChatAppearance }>("/business-profile/appearance");
  return res.data.data;
}

export async function getBusinessProfile() {
  const res = await http.get<{ data: BusinessProfile }>("/business-profile");
  return res.data.data;
}

export async function updateBusinessProfile(payload: Partial<BusinessProfile>) {
  const res = await http.patch<{ data: BusinessProfile }>("/business-profile", payload);
  return res.data.data;
}
