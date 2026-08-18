import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { useToday } from "../hooks/useHr";
import { PunchDialog } from "./PunchDialog";
import { cn } from "@/lib/utils";

/**
 * The attendance control, in the top bar (SRS 3.1).
 *
 * It lives in the shell rather than on a page because the whole point is that
 * it is the first and last thing someone touches each day — burying it behind
 * navigation guarantees forgotten logouts, which are the one attendance event
 * that costs an admin work to fix.
 *
 * The label states the *next* action, never the current state: "Log out" means
 * pressing it logs you out. A button labelled with its state ("Logged in") reads
 * as a status display and gets ignored.
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
            ? "You are logged in for today — press to log out"
            : "Record your attendance for today"
        }
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors",
          data.isPunchedIn
            ? "border-success/40 text-success hover:bg-success/10"
            : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{data.isPunchedIn ? "Log out" : "Log in"}</span>
      </button>
      <PunchDialog open={open} direction={direction} onClose={() => setOpen(false)} />
    </>
  );
}
