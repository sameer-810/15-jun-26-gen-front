import {
  LayoutDashboard,
  Target,
  Calculator,
  FileText,
  BookOpen,
  Boxes,
  LayoutTemplate,
  MapPin,
  ReceiptIndianRupee,
  BarChart3,
  Activity,
  Settings,
  Users,
} from "lucide-react";
import type { Role } from "@/modules/auth/authSlice";

export type MenuItem = {
  label: string;
  to?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Roles allowed to see this item. Omit = all authenticated roles. */
  roles?: Role[];
  children?: MenuItem[];
};

export type MenuSection = {
  /** Small uppercase group heading (hidden when the rail is collapsed). */
  heading?: string;
  items: MenuItem[];
};

/**
 * Grouped, role-aware navigation (2026 rail pattern). Items are filtered per
 * role by filterSections(); empty sections are dropped. A flat MENU is derived
 * for the ⌘K command palette.
 */
const SECTIONS: MenuSection[] = [
  {
    items: [{ label: "Dashboard", to: "/dashboard", icon: LayoutDashboard }],
  },
  {
    heading: "Sales",
    items: [
      { label: "Leads", to: "/leads", icon: Target, roles: ["admin", "manager", "sales"] },
      {
        label: "Capacity Calculator",
        to: "/capacity-calculator",
        icon: Calculator,
        roles: ["admin", "manager", "sales"],
      },
      {
        label: "Quotations & PI",
        to: "/quotations",
        icon: FileText,
        roles: ["admin", "manager", "sales"],
      },
    ],
  },
  {
    heading: "Operations",
    items: [
      {
        label: "Product Catalog",
        to: "/catalog",
        icon: BookOpen,
        roles: ["admin", "manager", "inventory", "sales"],
      },
      {
        label: "Inventory",
        to: "/inventory",
        icon: Boxes,
        roles: ["admin", "manager", "inventory", "sales"],
      },
      {
        label: "Sales",
        to: "/sales",
        icon: ReceiptIndianRupee,
        roles: ["admin", "manager", "sales", "inventory"],
      },
    ],
  },
  {
    heading: "Insights",
    items: [
      {
        label: "Reports",
        to: "/reports",
        icon: BarChart3,
        roles: ["admin", "manager", "sales", "inventory"],
      },
      { label: "Activity Log", to: "/activity", icon: Activity },
    ],
  },
  {
    heading: "Administration",
    items: [
      {
        label: "Templates",
        to: "/templates",
        icon: LayoutTemplate,
        roles: ["admin", "manager", "sales", "inventory"],
      },
      {
        label: "Locations",
        to: "/locations",
        icon: MapPin,
        roles: ["admin", "manager", "inventory"],
      },
      { label: "Settings", to: "/settings", icon: Settings, roles: ["admin"] },
      { label: "Users", to: "/users", icon: Users, roles: ["admin"] },
    ],
  },
];

/** Recursively keep items whose roles include the current role (or have no roles). */
export function filterMenu(items: MenuItem[], role: Role | undefined): MenuItem[] {
  return items
    .filter((item) => !item.roles || (role ? item.roles.includes(role) : false))
    .map((item) => (item.children ? { ...item, children: filterMenu(item.children, role) } : item))
    .filter((item) => !item.children || item.children.length > 0 || item.to);
}

/** Filter sections by role and drop any that end up empty. */
export function filterSections(role: Role | undefined): MenuSection[] {
  return SECTIONS.map((s) => ({ heading: s.heading, items: filterMenu(s.items, role) })).filter(
    (s) => s.items.length > 0,
  );
}

/** Flat list (all items across sections) — used by the command palette. */
export const MENU: MenuItem[] = SECTIONS.flatMap((s) => s.items);
export { SECTIONS };
