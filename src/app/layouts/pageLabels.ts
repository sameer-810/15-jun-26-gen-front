import { useLocation } from "react-router-dom";

/**
 * Human labels for path segments. 24-hex ids render as "Details".
 *
 * Five routes were missing — catalog, templates, locations, my-performance and
 * attendance — and fell through to the raw segment, so the crumb read
 * "my-performance" in lower case. Invisible enough on desktop, where the crumb
 * is a secondary aid; not invisible on a phone, where the same string is the
 * page title in the top bar.
 */
export const PATH_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  leads: "Leads",
  "capacity-calculator": "Capacity Calculator",
  quotations: "Quotations & PI",
  catalog: "Product Catalog",
  inventory: "Inventory",
  sales: "Sales",
  reports: "Reports",
  activity: "Activity Log",
  templates: "Templates",
  locations: "Locations",
  "my-performance": "My Performance",
  attendance: "Attendance & Targets",
  settings: "Settings",
  users: "Users",
};

export const isObjectId = (s: string) => /^[a-f\d]{24}$/i.test(s);

/**
 * The current screen's name.
 *
 * On a phone the breadcrumb trail is the wrong shape — "Leads › Details" eats a
 * third of a 390px bar to say something the back chevron already implies — so
 * the top bar shows the leaf label alone, and this is where it comes from.
 * Shared with Breadcrumbs so the two can never disagree.
 */
export function useCurrentPageLabel(): string {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "Dashboard";
  const leaf = segments[segments.length - 1];
  if (isObjectId(leaf)) {
    const parent = segments[segments.length - 2];
    // "Leads › 66f2…" reads better as "Lead" than as "Details".
    const parentLabel = parent ? (PATH_LABELS[parent] ?? parent) : "Details";
    return parentLabel.endsWith("s") ? parentLabel.slice(0, -1) : parentLabel;
  }
  return PATH_LABELS[leaf] ?? leaf;
}
