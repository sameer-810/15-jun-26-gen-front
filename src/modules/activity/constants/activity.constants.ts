import {
  UserPlus,
  Pencil,
  ArrowRightLeft,
  MessageSquare,
  CheckCircle2,
  FileText,
  ReceiptIndianRupee,
  XCircle,
  PackagePlus,
  Boxes,
  StickyNote,
  Trash2,
  Tag,
  PhoneCall,
  Send,
  BellRing,
} from "lucide-react";
import type { ActivityType, EntityType } from "../types";

export const ACTIVITY_META: Record<
  ActivityType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  lead_created: { label: "Lead Created", icon: UserPlus, color: "text-blue-500" },
  lead_updated: { label: "Lead Updated", icon: Pencil, color: "text-slate-500" },
  lead_status_changed: { label: "Status Changed", icon: ArrowRightLeft, color: "text-amber-500" },
  lead_deleted: { label: "Lead Deleted", icon: Trash2, color: "text-red-500" },
  lead_labelled: { label: "Labels Changed", icon: Tag, color: "text-slate-500" },
  follow_up_added: { label: "Follow-up", icon: MessageSquare, color: "text-indigo-500" },
  lead_converted: { label: "Lead Converted", icon: CheckCircle2, color: "text-green-500" },
  // Engagement events. These nine were missing entirely, so the lead timeline
  // rendered their raw type strings — "call_logged", "message_sent" — under a
  // default icon.
  call_logged: { label: "Call", icon: PhoneCall, color: "text-sky-500" },
  message_sent: { label: "Message Sent", icon: Send, color: "text-primary" },
  reply_received: { label: "Reply", icon: MessageSquare, color: "text-emerald-500" },
  reminder_set: { label: "Reminder Set", icon: BellRing, color: "text-amber-500" },
  reminder_completed: { label: "Reminder Done", icon: CheckCircle2, color: "text-emerald-500" },
  quotation_created: { label: "Quotation", icon: FileText, color: "text-primary" },
  proforma_created: { label: "Proforma", icon: FileText, color: "text-primary" },
  invoice_created: { label: "Invoice", icon: ReceiptIndianRupee, color: "text-primary" },
  invoice_issued: { label: "Invoice Issued", icon: ReceiptIndianRupee, color: "text-green-600" },
  sale_completed: { label: "Sale", icon: ReceiptIndianRupee, color: "text-green-600" },
  sale_voided: { label: "Sale Voided", icon: XCircle, color: "text-red-500" },
  inventory_created: { label: "Inventory Added", icon: Boxes, color: "text-amber-600" },
  inventory_updated: { label: "Inventory Updated", icon: Pencil, color: "text-slate-500" },
  stock_added: { label: "Stock Added", icon: PackagePlus, color: "text-emerald-500" },
  product_created: { label: "Product Added", icon: PackagePlus, color: "text-amber-600" },
  product_updated: { label: "Product Updated", icon: Pencil, color: "text-slate-500" },
  manual_note: { label: "Note", icon: StickyNote, color: "text-violet-500" },
};

export const ACTIVITY_TYPES = Object.keys(ACTIVITY_META) as ActivityType[];

export const ENTITY_TYPES: EntityType[] = [
  "lead",
  "quotation",
  "sale",
  "inventory",
  "user",
  "other",
];
