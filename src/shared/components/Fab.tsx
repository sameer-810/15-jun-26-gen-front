import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The screen's one primary create action, below `md`.
 *
 * On desktop "New Lead" lives in the page header, where there is room for it
 * alongside the title, the record count, Refresh and Import. At 390px that same
 * row wraps into three, and the result was the Leads screen opening with
 * "Import Leads" floating alone above its own page title. Lifting the single
 * primary action out to a fixed button fixes the header *and* puts the action
 * where a thumb already is.
 *
 * Exactly one per screen. A second FAB means the screen has no single primary
 * action, and the pattern is the wrong one for it — use the header overflow.
 */
export function Fab({
  onClick,
  label,
  icon: Icon = Plus,
  className,
}: {
  onClick: () => void;
  /** Announced to screen readers; the button itself is icon-only. */
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn("pg-fab md:hidden", className)}
    >
      <Icon className="h-6 w-6" />
    </button>
  );
}
