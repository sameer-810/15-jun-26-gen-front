import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Check, Clock, X } from "lucide-react";
import { FormDialog } from "@/modules/common/FormDialog";
import {
  useLeadLabels,
  useCreateLeadLabel,
  useDeleteLeadLabel,
  useSetLeadLabels,
  useCreateReminder,
  useSetReminderStatus,
  useDeleteReminder,
} from "../hooks/useLeadWorkspace";
import { useAddFollowUp } from "../hooks/useLeads";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  LEAD_STATUSES,
  LABEL_COLOR_CLASSES,
  LABEL_COLOR_DOTS,
  LABEL_COLORS,
} from "../constants/lead.constants";
import { useUpdateLead } from "../hooks/useLeads";
import { useAppSelector } from "@/app/hooks";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { formatDateTime } from "@/lib/utils";
import type { Lead, LeadStatus } from "../types";
import type { Reminder } from "../types.labels";

/**
 * "Manage Lead — Labels, Notes & Reminders", the panel from the IndiaMART
 * screenshot in Change Request point 11. One dialog covering the three things
 * a sales exec does to a lead between calls.
 */

const NOTE_MAX = 4000;

/** The two one-tap presets from the reference screen, plus a free choice. */
function presetToday7pm() {
  const d = new Date();
  d.setHours(19, 0, 0, 0);
  // If 7pm has already passed, the sensible "today" slot is an hour from now.
  if (d.getTime() <= Date.now()) d.setTime(Date.now() + 60 * 60 * 1000);
  return d;
}

function presetTomorrow10am() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

/** A Date → the value a datetime-local input expects, in local time. */
function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  reminders?: Reminder[];
  onSuccess?: () => void;
}

export function ManageLeadDialog({ open, onOpenChange, lead, reminders = [], onSuccess }: Props) {
  const role = useAppSelector((s) => s.auth.user?.role);
  const canManageLabels = role === "admin" || role === "manager";

  const { data: labels } = useLeadLabels(open);
  const createLabel = useCreateLeadLabel();
  const deleteLabel = useDeleteLeadLabel();
  const setLabels = useSetLeadLabels();
  const updateLead = useUpdateLead();
  const addFollowUp = useAddFollowUp();
  const createReminder = useCreateReminder();
  const setReminderStatus = useSetReminderStatus();
  const deleteReminder = useDeleteReminder();

  const [selected, setSelected] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("slate");
  const [note, setNote] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [reminderNote, setReminderNote] = useState("");

  useEffect(() => {
    if (!open || !lead) return;
    setSelected(lead.labels?.map((l) => l.id) ?? []);
    setNewLabel("");
    setNewLabelColor("slate");
    setNote("");
    setRemindAt("");
    setReminderNote("");
  }, [open, lead]);

  const pendingReminders = useMemo(
    () => reminders.filter((r) => r.status === "pending"),
    [reminders],
  );

  function toggleLabel(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function addLabel() {
    const name = newLabel.trim();
    if (!name) return;
    try {
      const created = await createLabel.mutateAsync({ name, color: newLabelColor });
      setSelected((prev) => [...prev, created.id]);
      setNewLabel("");
      toast.success(`Label "${created.name}" created`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function changeStatus(status: LeadStatus) {
    if (!lead) return;
    try {
      await updateLead.mutateAsync({ id: lead.id, payload: { status } });
      toast.success(`Status set to ${LEAD_STATUS_LABELS[status]}`);
      onSuccess?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function saveNote() {
    if (!lead || !note.trim()) return;
    try {
      await addFollowUp.mutateAsync({ id: lead.id, note: note.trim() });
      setNote("");
      toast.success("Note saved");
      onSuccess?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function saveReminder(when?: Date) {
    if (!lead) return;
    const at = when ?? (remindAt ? new Date(remindAt) : null);
    if (!at || Number.isNaN(at.getTime())) {
      toast.error("Pick a date and time first");
      return;
    }
    try {
      await createReminder.mutateAsync({
        lead: lead.id,
        remindAt: at.toISOString(),
        note: reminderNote.trim() || undefined,
      });
      setRemindAt("");
      setReminderNote("");
      toast.success(`Reminder set for ${formatDateTime(at)}`);
      onSuccess?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  /** Persist the label selection, then close. */
  async function save() {
    if (!lead) return;
    try {
      await setLabels.mutateAsync({ leadId: lead.id, labelIds: selected });
      toast.success("Lead updated");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  if (!lead) return null;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Manage Lead — Labels, Notes & Reminders"
      size="xl"
      onSubmit={save}
      isPending={setLabels.isPending}
      submitLabel="Save"
    >
      <div className="space-y-5" data-testid="manage-lead">
        {/* User-defined labels */}
        <section>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">
            USER DEFINED LABELS
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(labels ?? []).map((l) => {
              const on = selected.includes(l.id);
              return (
                <span key={l.id} className="inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => toggleLabel(l.id)}
                    data-testid={`label-chip-${l.id}`}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                      LABEL_COLOR_CLASSES[l.color] ?? LABEL_COLOR_CLASSES.slate
                    } ${on ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "opacity-70 hover:opacity-100"}`}
                  >
                    {on && <Check className="h-3 w-3" />}
                    {l.name}
                    {typeof l.leadCount === "number" && (
                      <span className="opacity-60">{l.leadCount}</span>
                    )}
                  </button>
                  {canManageLabels && (
                    <button
                      type="button"
                      aria-label={`Delete label ${l.name}`}
                      onClick={async () => {
                        try {
                          await deleteLabel.mutateAsync(l.id);
                          setSelected((prev) => prev.filter((x) => x !== l.id));
                          toast.success("Label deleted");
                        } catch (err) {
                          toast.error(getApiErrorMessage(err));
                        }
                      }}
                      className="ml-0.5 rounded p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              );
            })}
            {!labels?.length && (
              <p className="text-xs text-muted-foreground">No labels yet — create one below.</p>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addLabel();
                }
              }}
              placeholder="New label name"
              aria-label="New label name"
              className="w-48 rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex items-center gap-1">
              {LABEL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewLabelColor(c)}
                  aria-label={`Colour ${c}`}
                  className={`h-5 w-5 rounded-full ${LABEL_COLOR_DOTS[c]} ${
                    newLabelColor === c
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                      : ""
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addLabel}
              disabled={!newLabel.trim() || createLabel.isPending}
              data-testid="create-label"
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-40"
            >
              <Plus className="h-3 w-3" /> Create Label
            </button>
          </div>
        </section>

        {/* Pipeline status */}
        <section>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">LEAD STATUS</div>
          <div className="flex flex-wrap gap-1.5">
            {LEAD_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeStatus(s)}
                data-testid={`status-chip-${s}`}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                  LEAD_STATUS_COLORS[s]
                } ${lead.status === s ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "opacity-70 hover:opacity-100"}`}
              >
                {LEAD_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </section>

        {/* Notes + reminders, side by side like the reference screen */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <section>
            <div className="mb-2 text-xs font-semibold text-muted-foreground">ADD NOTES</div>
            <textarea
              rows={6}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Type your note here..."
              aria-label="Lead note"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {note.length}/{NOTE_MAX} Characters
              </span>
              <button
                type="button"
                onClick={saveNote}
                disabled={!note.trim() || addFollowUp.isPending}
                data-testid="save-note"
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
              >
                Save Note
              </button>
            </div>
          </section>

          <section>
            <div className="mb-2 text-xs font-semibold text-muted-foreground">SET REMINDER FOR</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => saveReminder(presetToday7pm())}
                data-testid="remind-today"
                className="rounded-lg border border-border px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
              >
                <div className="font-medium text-foreground">Today</div>
                <div className="text-muted-foreground">{formatDateTime(presetToday7pm())}</div>
              </button>
              <button
                type="button"
                onClick={() => saveReminder(presetTomorrow10am())}
                data-testid="remind-tomorrow"
                className="rounded-lg border border-border px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
              >
                <div className="font-medium text-foreground">Tomorrow</div>
                <div className="text-muted-foreground">{formatDateTime(presetTomorrow10am())}</div>
              </button>
            </div>

            <div className="mt-2 space-y-2">
              <input
                type="datetime-local"
                value={remindAt}
                min={toLocalInputValue(new Date())}
                onChange={(e) => setRemindAt(e.target.value)}
                aria-label="Pick date and time"
                data-testid="remind-custom"
                className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                value={reminderNote}
                onChange={(e) => setReminderNote(e.target.value)}
                placeholder="Reminder note (optional)"
                aria-label="Reminder note"
                className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => saveReminder()}
                disabled={!remindAt || createReminder.isPending}
                data-testid="remind-save"
                className="w-full rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
              >
                Set Reminder
              </button>
            </div>

            {pendingReminders.length > 0 && (
              <ul className="mt-3 space-y-1" data-testid="pending-reminders">
                {pendingReminders.map((r) => (
                  <li
                    key={r.id}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${
                      r.isDue ? "border-amber-500/40 bg-amber-500/10" : "border-border"
                    }`}
                  >
                    <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{formatDateTime(r.remindAt)}</span>
                      {r.note && (
                        <span className="block truncate text-muted-foreground">{r.note}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReminderStatus.mutate({ id: r.id, status: "done" })}
                      aria-label="Mark reminder done"
                      className="rounded p-1 text-emerald-600 hover:bg-emerald-500/10"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteReminder.mutate(r.id)}
                      aria-label="Delete reminder"
                      className="rounded p-1 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </FormDialog>
  );
}
