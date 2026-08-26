import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { useToday } from "../hooks/useHr";
import { PunchDialog } from "./PunchDialog";
import { cn } from "@/lib/utils";

/**
 * The attendance control, in the top bar (SRS 3.1).
 *
 * Lives in the shell, not on a page: it is the first and last thing someone
 * touches each day, and burying it behind navigation guarantees forgotten
 * punch-outs — the one attendance event that costs an admin work to fix.
 *
 * Two wording rules, both easy to undo by accident:
 *
 * - **The label states the next action, not the current state.** "Punch out"
 *   means pressing it punches you out. "Punched in" would read as a status
 *   display and get ignored.
 * - **"Punch", never "log".** The account menu on the same bar has a "Log out"
 *   that ends the session. Two controls reading alike and doing different
 *   things is a mis-click, and the accidental one closes a shift.
 */
export function PunchButton() {
  const { data, isLoading } = useToday();
  const [open, setOpen] = useState(false);

  if (isLoading || !data) return null;
  const direction = data.isPunchedIn ? "out" : "in";
  const Icon = data.isPunchedIn ? LogOut : LogIn;

  return (
    <>
      <button
        data-testid="punch-button"
        onClick={() => setOpen(true)}
        title={
          data.isPunchedIn
            ? "You are punched in for today — press to punch out. This does not sign you out of the CRM."
            : "Record your attendance for today"
        }
        className={cn(
          // Full-height target on a phone. This is pressed twice a day, often
          // one-handed on site, and 28px was too small to hit reliably.
          "flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors md:min-h-0 md:px-2.5",
          data.isPunchedIn
            ? "border-success/40 text-success hover:bg-success/10"
            : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{data.isPunchedIn ? "Punch out" : "Punch in"}</span>
      </button>
      <PunchDialog open={open} direction={direction} onClose={() => setOpen(false)} />
    </>
  );
}
