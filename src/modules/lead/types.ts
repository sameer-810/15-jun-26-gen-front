export type LeadStatus =
  | "new"
  | "important"
  | "contacted"
  | "follow_up"
  | "quotation_sent"
  | "negotiation"
  | "other"
  | "deal_done"
  | "converted"
  | "not_interested"
  | "irrelevant";
export type LeadSource =
  | "walk_in"
  | "referral"
  | "website"
  | "phone"
  | "exhibition"
  | "social_media"
  | "indiamart"
  | "other";
export type FuelType = "diesel" | "gas" | "petrol" | "any";

export type UserRef = { id: string; name?: string } | null;

export type FollowUp = {
  id: string;
  note: string;
  nextFollowUpDate?: string;
  createdByName?: string;
  createdAt: string;
};

export type Lead = {
  id: string;
  customerName: string;
  mobile?: string;
  alternateMobile?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  requirement?: string;
  requiredKva?: number;
  quantity: number;
  fuelType?: FuelType;
  estimatedValue?: number;
  source: LeadSource;
  status: LeadStatus;
  lostReason?: string;
  /** User-defined labels, independent of the pipeline status. */
  labels: { id: string; name: string; color: string }[];
  /** Enquiry timestamp at the source (IndiaMART etc.); absent for manual leads. */
  externalCreatedAt?: string;
  assignedTo: UserRef;
  createdBy: UserRef;
  nextFollowUpDate?: string;
  followUps: FollowUp[];
  /** Calling record (SRS 3.2) — denormalised from the activity log. */
  lastCallOutcome?:
    | "connected"
    | "no_answer"
    | "busy"
    | "wrong_number"
    | "callback_requested"
    | null;
  lastCallAt?: string | null;
  lastCallByName?: string | null;
  callCount?: number;
  convertedAt?: string;
  saleId?: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * The answered/unanswered toggle (SRS 3.2).
 *
 * `not_called` is a third bucket, not an absence of filter. A lead nobody has
 * rung and a lead that rang out mean opposite things to a salesperson — one is
 * work not started, the other is work that failed — so collapsing them would
 * bury the untouched leads inside a list read as "tried and failed".
 */
export type CallFilter = "answered" | "unanswered" | "not_called";

export type LeadListQuery = {
  search?: string;
  status?: LeadStatus;
  source?: LeadSource;
  assignedTo?: string;
  /** Matched against the lead's city, case-insensitive substring. */
  location?: string;
  minQuantity?: number;
  maxQuantity?: number;
  callFilter?: CallFilter;
  page: number;
  limit: number;
};

export type LeadListResult = {
  items: Lead[];
  meta: {
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    page: number;
    limit: number;
  };
};

export type LeadCreatePayload = {
  customerName: string;
  mobile?: string;
  alternateMobile?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  requirement?: string;
  requiredKva?: number;
  quantity?: number;
  fuelType?: FuelType;
  estimatedValue?: number;
  source?: LeadSource;
  status?: LeadStatus;
  assignedTo?: string;
  lostReason?: string;
  nextFollowUpDate?: string;
};

export type AssignableUser = { id: string; name: string; role: string };
