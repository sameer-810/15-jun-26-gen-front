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
  UserRound,
  CalendarCheck,
} from "lucide-react";
import type { Role } from "@/modules/auth/authSlice";

export type MenuItem = {
  label: string;
  /**
   * Label for the mobile tab bar, where a fifth of a 390px screen is all a tab
   * gets. "Quotations & PI" rendered as "Quotations &…", which is worse than a
   * shorter true name — the ampersand survives and the noun is what gets cut.
   * Falls back to `label`.
   */
  shortLabel?: string;
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
        shortLabel: "Quotes",
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
        shortLabel: "Catalog",
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
    heading: "My Work",
    items: [
      // Every role, including inventory — attendance and pay are not a
      // permission. The endpoint scopes each person to themselves.
      { label: "My Performance", to: "/my-performance", icon: UserRound },
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
      {
        label: "Attendance & Targets",
        to: "/attendance",
        icon: CalendarCheck,
        roles: ["admin", "manager"],
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

/**
 * Destination priority for the mobile tab bar, most-used first.
 *
 * A bottom bar holds four destinations plus "More" before the labels start
 * truncating at 390px, so this is a ranking, not a menu: the first four a given
 * role is allowed to see become tabs and everything else stays in the sheet.
 *
 * The order is by daily reach, not by the sidebar's grouping. A sales executive
 * opens Leads perhaps thirty times a day and Locations twice a year, and the
 * sidebar — organised by subject, correctly, for a screen with room for all
 * fifteen — gives no weight to that. Inventory sits above Quotations because the
 * inventory role has no access to quotations at all and needs its own four.
 */
const MOBILE_TAB_ORDER = [
  "/dashboard",
  "/leads",
  "/quotations",
  "/inventory",
  "/sales",
  "/catalog",
  "/my-performance",
  "/reports",
];

/**
 * The four destinations shown as tabs for a role, in bar order.
 *
 * Resolved against the same role-filtered menu the sidebar uses, so a permission
 * can never be granted here that the sidebar would deny — the bar is a view onto
 * the menu, not a second copy of it.
 */
export function mobileTabs(role: Role | undefined): MenuItem[] {
  const allowed = new Map(
    filterMenu(
      SECTIONS.flatMap((s) => s.items),
      role,
    )
      .filter((i) => i.to)
      .map((i) => [i.to as string, i]),
  );
  return MOBILE_TAB_ORDER.map((p) => allowed.get(p)).filter((i): i is MenuItem => Boolean(i));
}
