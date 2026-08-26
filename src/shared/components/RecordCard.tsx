import { Link } from "react-router-dom";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One record, as a card — the mobile counterpart to a table row, used below `md`.
 *
 * Slots read top-left to bottom-right, in the order someone decides whether to act:
 *
 *     ┌──────────────────────────────────────┐
 *     │ (RK)  Rajesh Kumar          ₹4,50,000│   disc · title · amount
 *     │       Pune · 125 kVA · ×3       [HOT]│   meta · badge
 *     │       ──────────────────────────────  │
 *     │       [ Call ]  [ WhatsApp ]      ⋯  │   actions
 *     └──────────────────────────────────────┘
 *
 * The title must stay a real `<a>` even though the whole card is tappable —
 * keyboard users, screen readers and "copy link address" all need an anchor.
 * See DESIGN.md, row activation.
 */
export function RecordCard({
  to,
  title,
  disc,
  meta,
  amount,
  badge,
  actions,
  onClick,
  className,
}: {
  /** Detail route. Omit for a record with no detail page — pass `onClick` instead. */
  to?: string;
  title: ReactNode;
  /** Initials for the identity disc. Omit to drop the disc entirely. */
  disc?: string;
  /** Secondary facts, joined with `·`. Falsy entries are dropped. */
  meta?: Array<ReactNode | null | undefined | false>;
  /** The record's headline figure, right-aligned and mono. */
  amount?: ReactNode;
  /** Status. Colour belongs here and nowhere else on the card. */
  badge?: ReactNode;
  /** Quick actions, rendered in a row beneath a hairline. */
  actions?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const facts = (meta ?? []).filter(Boolean);

  const body = (
    <>
      <div className="flex items-start gap-3">
        {disc && <span className="pg-disc mt-0.5">{disc.slice(0, 2)}</span>}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
              {to ? (
                <Link to={to} className="hover:text-primary" onClick={(e) => e.stopPropagation()}>
                  {title}
                </Link>
              ) : (
                title
              )}
            </div>
            {/*
              Amount and status share the right edge, stacked.

              The badge used to sit at the end of the meta line with `ml-auto`,
              which put it wherever the wrap happened to leave it — on the phone
              number's line for one record and alone on a fourth line for the
              next. Anchored here it lands in the same place on every card,
              which is the entire point of a list: the eye should find status
              without re-reading the layout each time.
            */}
            {(amount != null || badge) && (
              <div className="flex shrink-0 flex-col items-end gap-1">
                {amount != null && (
                  <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                    {amount}
                  </span>
                )}
                {badge}
              </div>
            )}
          </div>

          {facts.length > 0 && (
            <p className="mt-1 text-xs font-light leading-relaxed text-muted-foreground">
              {facts.map((f, i) => (
                <span key={i}>
                  {/*
                    The separator trails its fact rather than leading the next
                    one, so a wrapped line never begins with a floating "·".
                  */}
                  {f}
                  {i < facts.length - 1 && <span aria-hidden="true"> · </span>}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-2.5">{actions}</div>
      )}
    </>
  );

  return (
    <div
      className={cn("pg-card", (to || onClick) && "cursor-pointer", className)}
      // The card is an *enhancement* over the anchor in the title, never a
      // replacement — hence no role="link" and no tabIndex. A keyboard user
      // tabs to the real link; a thumb gets the whole 44px-plus block.
      onClick={onClick}
      role={onClick && !to ? "button" : undefined}
      tabIndex={onClick && !to ? 0 : undefined}
      onKeyDown={
        onClick && !to
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {body}
    </div>
  );
}

/**
 * A quick action on a card — call, WhatsApp, share.
 *
 * Full-width and sharing the row equally, because these are the two or three
 * things someone standing in front of a customer actually does, and a 26px icon
 * button is not a thumb target. Rendered as `<a>` when given an `href` so
 * `tel:` and `wa.me` hand off to the phone's own dialer and WhatsApp.
 *
 * `tone` exists only for WhatsApp's green, which is a brand mark people find by
 * colour rather than a status signal — every other action stays neutral, and
 * cobalt is reserved for the primary one.
 */
export function CardAction({
  icon: Icon,
  label,
  href,
  onClick,
  tone = "neutral",
  disabled,
  ...rest
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  onClick?: () => void;
  tone?: "neutral" | "primary" | "whatsapp";
  disabled?: boolean;
} & Record<string, unknown>) {
  const cls = cn(
    "pg-tap flex flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-colors",
    tone === "primary" && "border-primary bg-primary text-primary-foreground",
    tone === "whatsapp" &&
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400",
    tone === "neutral" && "border-border text-muted-foreground hover:bg-accent",
    disabled && "pointer-events-none opacity-40",
  );

  const inner = (
    <>
      <Icon className="h-4 w-4" />
      {label}
    </>
  );

  // stopPropagation so tapping an action never also opens the record behind it.
  if (href && !disabled) {
    return (
      <a href={href} className={cls} onClick={(e) => e.stopPropagation()} {...rest}>
        {inner}
      </a>
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      className={cls}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      {...rest}
    >
      {inner}
    </button>
  );
}

// `initialsOf` for the disc lives in `@/lib/utils` — a pure string helper.
// Import it from there; re-exporting it here would make this module export
// something that is not a component, which breaks fast refresh for the file.
