export type ActivityType =
  | "lead_created"
  | "lead_updated"
  | "lead_status_changed"
  | "lead_deleted"
  | "follow_up_added"
  | "lead_converted"
  | "quotation_created"
  | "proforma_created"
  | "sale_completed"
  | "sale_voided"
  | "inventory_created"
  | "inventory_updated"
  | "stock_added"
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
