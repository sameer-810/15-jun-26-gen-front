import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { PATH_LABELS, isObjectId } from "./pageLabels";

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs =
    segments.length === 0 || segments[0] === "dashboard"
      ? [{ label: "Dashboard", to: "/dashboard", last: true }]
      : segments.map((seg, i) => ({
          label: isObjectId(seg) ? "Details" : (PATH_LABELS[seg] ?? seg),
          to: "/" + segments.slice(0, i + 1).join("/"),
          last: i === segments.length - 1,
        }));

  return (
    <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-sm md:flex">
      {crumbs.map((c, i) => (
        <span key={c.to} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
          {c.last ? (
            <span className="font-semibold text-foreground">{c.label}</span>
          ) : (
            <Link
              to={c.to}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
