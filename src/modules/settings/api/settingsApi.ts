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
  nextQuotationNumber?: number;
  nextProformaNumber?: number;
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

export async function getBusinessProfile() {
  const res = await http.get<{ data: BusinessProfile }>("/business-profile");
  return res.data.data;
}

export async function updateBusinessProfile(payload: Partial<BusinessProfile>) {
  const res = await http.patch<{ data: BusinessProfile }>("/business-profile", payload);
  return res.data.data;
}
