import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Clock, Phone, X } from "lucide-react";
import { listReminders } from "../api/leadWorkspaceApi";
import { useSetReminderStatus, useUpdateReminder } from "../hooks/useLeadWorkspace";
import { useAppSelector } from "@/app/hooks";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { formatDateTime } from "@/lib/utils";
import type { Reminder } from "../types.labels";

/**
 * The reminder pop-up: when a reminder's time arrives, it appears on whatever
 * screen you are on.
 *
 * Reminders used to be a list on the dashboard, which only works if someone
 * goes and looks at the dashboard at the right minute. This polls for my due
 * reminders on every screen and puts them in front of me.
 *
 * Deliberately **not modal**. It arrives uninvited, often mid-quotation, so it
 * sits in a corner and lets the work under it carry on; blocking the page would
 * make people dismiss it reflexively just to get their screen back.
 *
 * Closing it is "later", not "gone": the reminder is still pending, so it
 * returns after LATER_MS. Only Done ends it, and Snooze moves its saved time.
 */

/** How often to check. A reminder therefore shows within this long of its time. */
const POLL_MS = 30_000;
/** How long closing the pop-up keeps a reminder out of it. Not saved. */
const LATER_MS = 10 * 60_000;
/** How far Snooze moves the reminder. Saved, so the dashboard shows the new time. */
const SNOOZE_MS = 10 * 60_000;

const HIDDEN_KEY = "srf.reminderAlerts.hiddenUntil";

/** Per-tab memory of reminders closed with "later". Storage can be unavailable. */
function readHidden(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(HIDDEN_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeHidden(value: Record<string, number>) {
  try {
    sessionStorage.setItem(HIDDEN_KEY, JSON.stringify(value));
  } catch {
    // Nothing to do: the reminder simply returns sooner.
  }
}

/** A short two-note chime. The panel is the alert; sound only draws the eye to it. */
function chime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
    setTimeout(() => void ctx.close(), 800);
  } catch {
    // Autoplay can be blocked; the panel still shows.
  }
}

function minutesLate(remindAt: string, now: number) {
  return Math.floor((now - new Date(remindAt).getTime()) / 60_000);
}

const actionCls =
  "pg-tap flex items-center justify-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-40";

export function ReminderAlerts() {
  const role = useAppSelector((s) => s.auth.user?.role);
  // Reminders hang off leads, which the inventory role has no access to.
  const enabled = role === "admin" || role === "manager" || role === "sales";

  const navigate = useNavigate();
  const setStatus = useSetReminderStatus();
  const update = useUpdateReminder();

  const [hiddenUntil, setHiddenUntil] = useState<Record<string, number>>(readHidden);
  const [now, setNow] = useState(() => Date.now());
  const [permission, setPermission] = useState(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  const { data } = useQuery({
    queryKey: ["reminders", "due-alerts"],
    // "Due by now" is computed per request, so it is not part of the key.
    queryFn: () =>
      listReminders({
        status: "pending",
        mine: "true",
        dueBefore: new Date().toISOString(),
        limit: 20,
      }),
    enabled,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
  });

  // Lets a reminder closed with "later" come back without waiting for new data.
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(Date.now()), POLL_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  const due = useMemo(
    () => (data?.items ?? []).filter((r) => r.leadId && (hiddenUntil[r.id] ?? 0) <= now),
    [data, hiddenUntil, now],
  );

  // Sound and desktop notification once per appearance, not on every poll.
  const announced = useRef(new Set<string>());
  useEffect(() => {
    const fresh = due.filter((r) => !announced.current.has(r.id));
    if (!fresh.length) return;
    fresh.forEach((r) => announced.current.add(r.id));
    chime();

    if (
      document.hidden &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      for (const r of fresh.slice(0, 3)) {
        const n = new Notification(`Reminder: ${r.lead?.customerName ?? "Lead"}`, {
          body: r.note || `Due ${formatDateTime(r.remindAt)}`,
          tag: `reminder-${r.id}`,
        });
        n.onclick = () => {
          window.focus();
          navigate(`/leads/${r.leadId}`);
          n.close();
        };
      }
    }
  }, [due, navigate]);

  // "(2) Reminder · SRF Power Machine" — visible from another tab.
  useEffect(() => {
    if (!due.length) return;
    const original = document.title;
    document.title = `(${due.length}) Reminder · ${original}`;
    return () => {
      document.title = original;
    };
  }, [due.length]);

  function later(ids: string[]) {
    setHiddenUntil((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        next[id] = Date.now() + LATER_MS;
        // So it chimes again when it comes back.
        announced.current.delete(id);
      }
      writeHidden(next);
      return next;
    });
  }

  async function markDone(r: Reminder) {
    try {
      await setStatus.mutateAsync({ id: r.id, status: "done" });
      toast.success(`Reminder for ${r.lead?.customerName ?? "lead"} done`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function snooze(r: Reminder) {
    const at = new Date(Date.now() + SNOOZE_MS);
    try {
      await update.mutateAsync({ id: r.id, remindAt: at.toISOString() });
      announced.current.delete(r.id);
      toast.success(`Snoozed until ${formatDateTime(at)}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  function openLead(r: Reminder) {
    // Out of the way while they work on it; it is still pending until Done.
    later([r.id]);
    navigate(`/leads/${r.leadId}`);
  }

  async function allowDesktopAlerts() {
    if (typeof Notification === "undefined") return;
    setPermission(await Notification.requestPermission());
  }

  if (!enabled || due.length === 0) return null;

  const busy = setStatus.isPending || update.isPending;

  return (
    /*
      z-40, one level under dialogs and sheets (z-50). The corner it sits in is
      where a dialog keeps its Save button and a table its row actions, so a
      reminder drawn over an open dialog hid the very button someone was about to
      press. Under the dialog it waits for the dialog to close instead.
    */
    <section
      role="alert"
      aria-live="assertive"
      aria-label="Due reminders"
      data-testid="reminder-alerts"
      className="pg-overlay animate-overlay-in fixed inset-x-3 bottom-20 z-40 flex max-h-[70vh] flex-col overflow-hidden md:inset-x-auto md:bottom-6 md:right-6 md:w-[380px]"
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BellRing className="h-4 w-4 text-warning" />
          {due.length === 1 ? "Reminder" : `${due.length} reminders`}
        </h2>
        {due.length > 1 && (
          <button
            onClick={() => later(due.map((r) => r.id))}
            className="pg-tap rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Later for all
          </button>
        )}
      </header>

      <ul className="divide-y divide-border overflow-y-auto">
        {due.map((r) => {
          const late = minutesLate(r.remindAt, now);
          return (
            <li key={r.id} data-testid={`reminder-alert-${r.id}`} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {r.lead?.customerName ?? "Lead"}
                  </p>
                  {(r.lead?.mobile || r.lead?.city) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {r.lead?.mobile && (
                        <span className="font-mono tabular-nums">{r.lead.mobile}</span>
                      )}
                      {r.lead?.mobile && r.lead?.city ? " · " : ""}
                      {r.lead?.city}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => later([r.id])}
                  aria-label={`Remind me about ${r.lead?.customerName ?? "this lead"} later`}
                  title="Remind me in 10 minutes"
                  className="pg-tap -mr-1.5 -mt-1 shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {r.note && <p className="mt-1.5 text-sm text-foreground">{r.note}</p>}

              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono tabular-nums">{formatDateTime(r.remindAt)}</span>
                {late >= 1 && (
                  <span className="font-mono tabular-nums text-warning">
                    · {late < 60 ? `${late} min` : `${Math.floor(late / 60)} h`} late
                  </span>
                )}
              </p>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <button
                  onClick={() => markDone(r)}
                  disabled={busy}
                  className="pg-tap flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                >
                  Done
                </button>
                <button onClick={() => snooze(r)} disabled={busy} className={actionCls}>
                  Snooze 10 min
                </button>
                <button onClick={() => openLead(r)} className={actionCls}>
                  Open lead
                </button>
                {r.lead?.mobile && (
                  <a
                    href={`tel:${r.lead.mobile}`}
                    aria-label={`Call ${r.lead.customerName ?? "customer"}`}
                    className={`${actionCls} md:hidden`}
                  >
                    <Phone className="h-3.5 w-3.5" /> Call
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {permission === "default" && (
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          Get these even when the CRM tab is in the background.{" "}
          <button onClick={allowDesktopAlerts} className="font-medium text-primary hover:underline">
            Allow desktop alerts
          </button>
        </p>
      )}
    </section>
  );
}
