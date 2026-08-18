/**
 * Mirrors ACTIVITY_TYPES in the backend's activity model.
 *
 * This had drifted: the server has been emitting `call_logged`,
 * `message_sent`, `reply_received` and six others for some time, none of which
 * were in this union. Nothing crashed — the timeline falls back to a default
 * icon — but TypeScript could not check any code branching on activity type,
 * which is exactly how a `type === "message_sent"` comparison ends up silently
 * always false. Keep the two lists in step.
 */
export type ActivityType =
  | "lead_created"
  | "lead_updated"
  | "lead_status_changed"
  | "lead_deleted"
  | "lead_labelled"
  | "follow_up_added"
  | "lead_converted"
  // Engagement events — what the lead-detail counters are built from.
  | "call_logged"
  | "message_sent"
  | "reply_received"
  | "reminder_set"
  | "reminder_completed"
  | "quotation_created"
  | "proforma_created"
  | "invoice_created"
  | "invoice_issued"
  | "sale_completed"
  | "sale_voided"
  | "inventory_created"
  | "inventory_updated"
  | "stock_added"
  | "product_created"
  | "product_updated"
  | "manual_note";

export type EntityType = "lead" | "quotation" | "sale" | "inventory" | "user" | "other";

export type Activity = {
  id: string;
  type: ActivityType;
  action: string;
  user: { id: string; name?: string } | null;
  userName?: string;
  entityType: EntityType;
  entityId?: string | null;
  entityLabel?: string;
  leadId?: string | null;
  remarks?: string;
  createdAt: string;
};

export type ActivityListQuery = {
  search?: string;
  type?: ActivityType;
  entityType?: EntityType;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
};

export type ActivityListResult = {
  items: Activity[];
  meta: {
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    page: number;
    limit: number;
  };
};
