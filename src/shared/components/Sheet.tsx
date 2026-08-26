import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A bottom sheet — the mobile counterpart to a centred dialog. Full-bleed and
 * anchored to the edge the thumb is already near, rather than a narrow modal
 * with its Save button in the vertical middle.
 *
 * Three behaviours are load-bearing, not decoration:
 *
 *  1. **Drag to dismiss engages from the header/grip only.** Dragging from the
 *     body fights a scrolling form — that is the classic sheet bug where
 *     scrolling up past the top yanks the sheet closed mid-edit. Tracked on
 *     pointer events so it also works with a mouse in devtools.
 *  2. **Escape closes and focus returns** to whatever opened it.
 *  3. **The page behind is scroll-locked.** Without it, flicking past the end
 *     of the sheet scrolls the list underneath and closing leaves the user
 *     somewhere else entirely.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
  /** Suppress the drag affordance for a sheet that must be dismissed deliberately. */
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const dragFrom = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open, onOpenChange]);

  // Reset the drag offset whenever the sheet reopens, or a sheet closed by a
  // drag would reappear already pushed halfway down the screen.
  useEffect(() => {
    if (open) setDragY(0);
  }, [open]);

  if (!open) return null;

  function startDrag(e: React.PointerEvent) {
    if (!dismissible) return;
    dragFrom.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function moveDrag(e: React.PointerEvent) {
    if (dragFrom.current === null) return;
    // Downward only. Allowing an upward drag would let the sheet be pulled off
    // the top of the screen, which no platform sheet does.
    setDragY(Math.max(0, e.clientY - dragFrom.current));
  }
  function endDrag() {
    if (dragFrom.current === null) return;
    // ~110px is the point past which the gesture reads as "put it away" rather
    // than as an accidental brush while reaching for a field.
    if (dragY > 110) onOpenChange(false);
    setDragY(0);
    dragFrom.current = null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Close"
        tabIndex={-1}
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 animate-overlay-in bg-black/50"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
        className={cn("pg-sheet relative", !dragY && "transition-transform duration-200")}
      >
        <div
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={cn("shrink-0", dismissible && "cursor-grab touch-none active:cursor-grabbing")}
        >
          {dismissible && <div className="pg-sheet-grip" />}
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 pb-3">
            <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="pg-tap -mr-2 flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {footer && (
          <div className="pg-safe-bottom shrink-0 border-t border-border px-4 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
