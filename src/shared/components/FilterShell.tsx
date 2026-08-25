import { type ReactNode } from "react";
import { Sheet } from "./Sheet";

/**
 * Holds a page's filter controls, inline on desktop and in a sheet on mobile.
 *
 * `ResourceListPage` does this itself for the five screens it drives; this is
 * the same behaviour for the pages that predate it and own their own tables
 * (Sales, Attendance, Reports). Without it those screens open on a phone with
 * several hundred pixels of form and the data pushed off the bottom — the exact
 * complaint that started this work.
 *
 * The footer button is not decoration. A sheet with no obvious way out gets
 * dismissed by tapping the scrim, which people do not discover; and stating the
 * result count on the button turns "apply" into feedback — you can see the
 * filter worked before you commit to it.
 */
export function FilterShell({
  isMobile,
  open,
  onOpenChange,
  total,
  children,
}: {
  isMobile: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Row count after filtering, shown on the confirm button. */
  total?: number;
  children: ReactNode;
}) {
  if (isMobile) {
    return (
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title="Filters"
        footer={
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="pg-tap w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {total == null ? (
              "Done"
            ) : (
              <>
                Show <span className="font-mono tabular-nums">{total}</span> results
              </>
            )}
          </button>
        }
      >
        <div className="space-y-4">{children}</div>
      </Sheet>
    );
  }

  /*
    The desktop container. Was `rounded-xl … shadow-sm` on several pages — an
    in-page panel claiming elevation it has not earned. `pg-tile` is the house
    primitive: hairline, background shift, no shadow. See DESIGN.md.
  */
  return <div className="pg-tile flex flex-wrap items-end gap-3">{children}</div>;
}
