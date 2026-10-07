import { useEffect, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { Sheet } from "@/shared/components/Sheet";
import { PushOptIn } from "@/shared/components/PushOptIn";
import { useIsMobile } from "@/shared/hooks/useMediaQuery";
import { useCreateReminder, useLogCall } from "../hooks/useLeadWorkspace";
import { useUpdateLead } from "../hooks/useLeads";
import {
  CALL_OUTCOMES,
  CALL_OUTCOME_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_LABELS,
} from "../constants/lead.constants";
import { presetToday7pm, presetTomorrow10am, toLocalInputValue } from "../utils/reminderPresets";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { formatDateTime } from "@/lib/utils";
import type { CallOutcome } from "../api/leadWorkspaceApi";
import type { Lead, LeadStatus } from "../types";

/**
 * The three things a salesperson does to a lead between calls, each as one
 * small sheet opened from the lead's own card: mark how the call went, set a
 * reminder, move its status.
 *
 * Working a follow-up list used to mean opening every lead: into the record,
 * log the call, set the date, back out — and the list returned at page 1. Here
 * each update is a tap on the card and a tap in the sheet, and the list
 * underneath never moves.
 *
 * Two decisions shape it:
 *
 *  - **A tap saves.** There is no Save button on the call result or the status:
 *    choosing *is* the action. Anything optional (a reminder, a note) sits
 *    above the choices so it is set before the tap that commits.
 *  - **The sheet closes first, then saves.** The next card is what the thumb is
 *    reaching for; a spinner in the way would cost a second per lead across a
 *    list of fifty. A failure still arrives as a toast naming the lead.
 */
export type LeadQuick = {
  kind: "remark" | "reminder" | "status";
  lead: Lead;
  /**
   * Opened because the Call button was just tapped. The dialler has been
   * opened, so the attempt is recorded even if this sheet is closed unanswered.
   */
  afterCall?: boolean;
};

type RemindChoice = "none" | "today" | "tomorrow" | "custom";

const TITLES: Record<LeadQuick["kind"], string> = {
  remark: "Call result",
  reminder: "Reminder",
  status: "Status",
};

const rowCls =
  "pg-tap flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 text-left text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-accent";
const inputCls =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring";
const labelCls = "mb-1.5 block text-xs font-medium text-muted-foreground";

/** A bottom sheet on a phone, a small centred panel on a desktop. */
function Panel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open onOpenChange={(open) => !open && onClose()} title={title}>
        {children}
      </Sheet>
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="pg-overlay w-full max-w-sm p-5"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="truncate text-base font-semibold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LeadQuickSheet({
  quick,
  onClose,
}: {
  quick: LeadQuick | null;
  onClose: () => void;
}) {
  const logCall = useLogCall();
  const createReminder = useCreateReminder();
  const updateLead = useUpdateLead();

  const [remind, setRemind] = useState<RemindChoice>("none");
  const [customAt, setCustomAt] = useState("");
  const [note, setNote] = useState("");

  // A fresh sheet per lead: the last lead's note must not ride along on the next.
  const openKey = quick ? `${quick.kind}:${quick.lead.id}` : "";
  useEffect(() => {
    setRemind("none");
    setCustomAt("");
    setNote("");
  }, [openKey]);

  if (!quick) return null;
  const { kind, lead, afterCall } = quick;
  const noteText = note.trim() || undefined;

  /** Close, then save. See the note at the top of the file. */
  function run(work: () => Promise<string>) {
    onClose();
    work()
      .then((message) => toast.success(message))
      .catch((err) => toast.error(`${lead.customerName}: ${getApiErrorMessage(err)}`));
  }

  /** The reminder picked alongside a call result, if any. */
  function pickedTime(): Date | null | "missing" {
    if (remind === "today") return presetToday7pm();
    if (remind === "tomorrow") return presetTomorrow10am();
    if (remind === "custom") {
      const at = customAt ? new Date(customAt) : null;
      return at && !Number.isNaN(at.getTime()) ? at : "missing";
    }
    return null;
  }

  function saveCall(outcome?: CallOutcome) {
    const at = pickedTime();
    if (at === "missing") {
      toast.error("Pick the reminder's date and time, or choose No reminder");
      return;
    }
    run(async () => {
      await logCall.mutateAsync({ leadId: lead.id, outcome, note: noteText });
      if (at) {
        await createReminder.mutateAsync({
          lead: lead.id,
          remindAt: at.toISOString(),
          note: noteText,
        });
      }
      const what = outcome ? CALL_OUTCOME_LABELS[outcome] : "Call logged";
      return at
        ? `${lead.customerName}: ${what}, reminder ${formatDateTime(at)}`
        : `${lead.customerName}: ${what}`;
    });
  }

  function saveReminder(at: Date) {
    if (Number.isNaN(at.getTime())) {
      toast.error("Pick a date and time first");
      return;
    }
    run(async () => {
      await createReminder.mutateAsync({
        lead: lead.id,
        remindAt: at.toISOString(),
        note: noteText,
      });
      return `${lead.customerName}: reminder ${formatDateTime(at)}`;
    });
  }

  function saveStatus(status: LeadStatus) {
    if (status === lead.status) {
      onClose();
      return;
    }
    run(async () => {
      await updateLead.mutateAsync({ id: lead.id, payload: { status } });
      return `${lead.customerName}: ${LEAD_STATUS_LABELS[status]}`;
    });
  }

  /**
   * Closing the sheet. After a call the attempt is still recorded, with no
   * result: the dialler was opened, and "called, result not marked" is true
   * where silently dropping it would leave the lead reading as never called.
   */
  function dismiss() {
    if (kind === "remark" && afterCall) {
      run(async () => {
        await logCall.mutateAsync({ leadId: lead.id, note: noteText });
        return `${lead.customerName}: call logged, result not marked`;
      });
      return;
    }
    onClose();
  }

  const who = (
    <p className="mb-4 text-sm text-muted-foreground">
      {lead.customerName}
      {lead.mobile && <span className="font-mono tabular-nums"> · {lead.mobile}</span>}
    </p>
  );

  const noteField = (
    <label className="block">
      <span className={labelCls}>Note (optional)</span>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        placeholder={kind === "remark" ? "What was said, or why it didn't connect" : "What to do"}
        className={inputCls}
      />
    </label>
  );

  return (
    <Panel title={TITLES[kind]} onClose={dismiss}>
      {who}

      {kind === "remark" && (
        <div className="space-y-4" data-testid="lead-quick-remark">
          <div>
            <span className={labelCls}>Remind me</span>
            {/* A grid, not a scrolling strip: with four choices the last one,
                "Pick time", sat off the right edge where nobody would find it. */}
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ["none", "No reminder"],
                  ["today", `Today ${timeOf(presetToday7pm())}`],
                  ["tomorrow", `Tomorrow ${timeOf(presetTomorrow10am())}`],
                  ["custom", "Pick time"],
                ] as [RemindChoice, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={remind === value}
                  onClick={() => setRemind(value)}
                  className="pg-chip pg-tap w-full justify-center"
                >
                  {label}
                </button>
              ))}
            </div>
            {remind === "custom" && (
              <input
                type="datetime-local"
                value={customAt}
                min={toLocalInputValue(new Date())}
                onChange={(e) => setCustomAt(e.target.value)}
                aria-label="Reminder date and time"
                className={`${inputCls} mt-2`}
              />
            )}
          </div>

          {noteField}

          <div>
            <span className={labelCls}>How did the call go? Tap to save</span>
            <div className="grid grid-cols-2 gap-1.5">
              {(CALL_OUTCOMES as CallOutcome[]).map((o) => (
                <button
                  key={o}
                  type="button"
                  data-testid={`call-outcome-${o}`}
                  onClick={() => saveCall(o)}
                  className={rowCls}
                >
                  {CALL_OUTCOME_LABELS[o]}
                </button>
              ))}
            </div>
          </div>

          {afterCall && (
            <button
              type="button"
              data-testid="call-outcome-unknown"
              onClick={() => saveCall(undefined)}
              className="pg-tap w-full rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Not sure — just log the attempt
            </button>
          )}
        </div>
      )}

      {kind === "reminder" && (
        <div className="space-y-4" data-testid="lead-quick-reminder">
          {noteField}

          <div>
            <span className={labelCls}>Remind me. Tap to save</span>
            <div className="grid gap-1.5">
              {(
                [
                  ["Today", presetToday7pm()],
                  ["Tomorrow", presetTomorrow10am()],
                ] as [string, Date][]
              ).map(([label, at]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => saveReminder(at)}
                  className={rowCls}
                >
                  {label}
                  <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">
                    {formatDateTime(at)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={labelCls}>Or pick a date and time</span>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={customAt}
                min={toLocalInputValue(new Date())}
                onChange={(e) => setCustomAt(e.target.value)}
                aria-label="Reminder date and time"
                className={inputCls}
              />
              <button
                type="button"
                disabled={!customAt}
                onClick={() => saveReminder(new Date(customAt))}
                className="pg-tap shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
              >
                Set
              </button>
            </div>
          </div>

          <PushOptIn />
        </div>
      )}

      {kind === "status" && (
        <div className="grid grid-cols-2 gap-1.5" data-testid="lead-quick-status">
          {LEAD_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={lead.status === s}
              onClick={() => saveStatus(s)}
              className={rowCls}
            >
              {/* The same pill the card wears, so the choice reads as the result. */}
              <span
                className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${LEAD_STATUS_COLORS[s]}`}
              >
                {LEAD_STATUS_LABELS[s]}
              </span>
              {lead.status === s && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** "07:00 pm" — the preset chips name the day themselves. */
function timeOf(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}
