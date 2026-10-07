import { cn } from "@/lib/utils";
import { usePushNotifications } from "@/shared/hooks/usePushNotifications";

/**
 * The one-line offer to get reminders on this device when the CRM is closed.
 *
 * Shown where a reminder is being set or read, because that is the moment the
 * question "will I actually be told?" is live. It says only what applies to
 * this device, and says nothing at all when there is nothing the person can do
 * (already on, or a browser that cannot).
 *
 * `showStatus` also renders the "on" state with a way to turn it off — for the
 * one place that acts as the setting (the dashboard's reminders panel).
 */
export function PushOptIn({
  showStatus = false,
  className,
}: {
  showStatus?: boolean;
  className?: string;
}) {
  const { state, busy, enable, disable } = usePushNotifications();

  const linkCls = "font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50";
  const boxCls = cn(
    "rounded-lg border border-border px-3 py-2.5 text-xs leading-relaxed text-muted-foreground",
    className,
  );

  if (state === "off") {
    return (
      <p className={boxCls} data-testid="push-opt-in">
        Get reminders on this device even when the CRM is closed.{" "}
        <button type="button" onClick={enable} disabled={busy} className={linkCls}>
          Turn on notifications
        </button>
      </p>
    );
  }

  if (state === "needs-install") {
    return (
      <p className={boxCls} data-testid="push-opt-in">
        To get reminders on this iPhone, add the CRM to your home screen: tap{" "}
        <span className="font-medium text-foreground">Share</span>, then{" "}
        <span className="font-medium text-foreground">Add to Home Screen</span>, and open it from
        there.
      </p>
    );
  }

  if (state === "blocked") {
    return (
      <p className={boxCls} data-testid="push-opt-in">
        Notifications are blocked for this site, so reminders only show while the CRM is open. Allow
        them in the browser&apos;s site settings to get them here.
      </p>
    );
  }

  if (state === "on" && showStatus) {
    return (
      <p className={boxCls} data-testid="push-opt-in">
        Reminders notify this device, even when the CRM is closed.{" "}
        <button type="button" onClick={disable} disabled={busy} className={linkCls}>
          Turn off
        </button>
      </p>
    );
  }

  return null;
}
