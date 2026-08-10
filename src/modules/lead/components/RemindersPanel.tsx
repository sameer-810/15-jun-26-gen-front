import { Link } from "react-router-dom";
import { BellRing, Check, Clock } from "lucide-react";
import { useReminders, useSetReminderStatus } from "../hooks/useLeadWorkspace";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { formatDateTime } from "@/lib/utils";

/**
 * "What do I owe someone a call about?" — my pending reminders, soonest first,
 * with the overdue ones highlighted. Sits on the dashboard so the reminders set
 * in the Manage Lead panel (Change Request point 11) actually resurface.
 */
export function RemindersPanel({ limit = 6 }: { limit?: number }) {
  const { data, isLoading } = useReminders({ status: "pending", mine: "true", limit });
  const setStatus = useSetReminderStatus();

  const reminders = data?.items ?? [];
  const dueCount = reminders.filter((r) => r.isDue).length;

  async function complete(id: string) {
    try {
      await setStatus.mutateAsync({ id, status: "done" });
      toast.success("Reminder completed");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="pg-tile" data-testid="reminders-panel">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <BellRing className="h-4 w-4 text-amber-500" />
            My Reminders
          </h2>
          <p className="text-xs text-muted-foreground">
            {dueCount > 0 ? `${dueCount} due now` : "Nothing due right now"}
          </p>
        </div>
        {data?.meta?.total ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {data.meta.total}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : reminders.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No pending reminders. Set one from a lead's Manage Lead panel.
        </p>
      ) : (
        <ul className="space-y-2">
          {reminders.map((r) => (
            <li
              key={r.id}
              data-testid={`reminder-${r.id}`}
              className={`flex items-center gap-2 rounded-lg border p-2.5 text-sm ${
                r.isDue ? "border-amber-500/40 bg-amber-500/10" : "border-border"
              }`}
            >
              <Clock
                className={`h-4 w-4 shrink-0 ${r.isDue ? "text-amber-600" : "text-muted-foreground"}`}
              />
              <div className="min-w-0 flex-1">
                {r.leadId ? (
                  <Link
                    to={`/leads/${r.leadId}`}
                    className="block truncate font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {r.lead?.customerName ?? "Lead"}
                  </Link>
                ) : (
                  <span className="block truncate font-medium">{r.lead?.customerName ?? "—"}</span>
                )}
                <span className="block text-xs text-muted-foreground">
                  {formatDateTime(r.remindAt)}
                  {r.note ? ` · ${r.note}` : ""}
                </span>
              </div>
              <button
                onClick={() => complete(r.id)}
                disabled={setStatus.isPending}
                aria-label={`Mark reminder for ${r.lead?.customerName ?? "lead"} done`}
                className="shrink-0 rounded-md p-1.5 text-emerald-600 transition-colors hover:bg-emerald-500/10 disabled:opacity-40"
              >
                <Check className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
