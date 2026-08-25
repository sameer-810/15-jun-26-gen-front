import { useState } from "react";
import { Pencil, Plus, RefreshCw, Power } from "lucide-react";
import { useUsers, useUpdateUser } from "../hooks/useUsers";
import { UserDialog } from "../components/UserDialog";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { formatDate, initialsOf } from "@/lib/utils";
import { PageLoader } from "@/shared/components/PageLoader";
import { useIsMobile } from "@/shared/hooks/useMediaQuery";
import { Fab } from "@/shared/components/Fab";
import { RecordCard, CardAction } from "@/shared/components/RecordCard";
import type { AuthUser } from "@/modules/auth/authSlice";

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-primary/15 text-primary",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  sales: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  inventory: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export function UsersPage() {
  const { data: users, isLoading, refetch } = useUsers();
  const isMobile = useIsMobile();
  const updateMutation = useUpdateUser();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<AuthUser | null>(null);

  async function toggleActive(u: AuthUser) {
    try {
      await updateMutation.mutateAsync({ id: u.id, payload: { isActive: !u.isActive } });
      toast.success(u.isActive ? "User deactivated" : "User activated");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="erp-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="hidden text-xl font-bold text-foreground md:block">Users &amp; Roles</h1>
          <p className="text-sm text-muted-foreground">
            <span className="hidden md:inline">Manage staff accounts and role-based access · </span>
            <span className="font-mono tabular-nums">{users?.length ?? 0}</span> users
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            aria-label="Refresh"
            className="pg-tap flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:min-h-0 md:min-w-0 md:border md:border-border md:bg-card md:px-3 md:py-2 md:text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden md:inline">Refresh</span>
          </button>
          <button
            onClick={() => {
              setMode("create");
              setEditing(null);
              setDialogOpen(true);
            }}
            className="hidden items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 md:flex"
          >
            <Plus className="h-4 w-4" />
            New User
          </button>
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : isMobile ? (
        <div className="space-y-2">
          {users?.map((u) => (
            <RecordCard
              key={u.id}
              disc={initialsOf(u.name)}
              title={u.name}
              meta={[u.email, u.phone, `Joined ${formatDate(u.createdAt)}`]}
              badge={
                <span
                  className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ROLE_BADGE[u.role] ?? ""}`}
                >
                  {u.role}
                </span>
              }
              actions={
                <>
                  <CardAction
                    icon={Pencil}
                    label="Edit"
                    onClick={() => {
                      setMode("edit");
                      setEditing(u);
                      setDialogOpen(true);
                    }}
                  />
                  <CardAction
                    icon={Power}
                    label={u.isActive ? "Disable" : "Enable"}
                    onClick={() => toggleActive(u)}
                  />
                </>
              }
            />
          ))}
        </div>
      ) : (
        /*
          Two DESIGN.md corrections this table had missed. `rounded-xl … shadow-sm`
          was an in-page panel claiming elevation — `pg-panel` is the primitive —
          and "Actions" was sitting in the anchor position, so every row opened
          with the same Edit/Disable pair and the person's name was pushed to
          second place. Actions belong last, after the data you read to decide
          whether to act.
        */
        <div className="pg-panel max-h-[calc(100vh-15rem)] overflow-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="pg-thead">
              <tr className="border-b border-border">
                {["Name", "Email", "Role", "Phone", "Status", "Created", "Actions"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className={`whitespace-nowrap px-4 py-2.5 text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground ${
                      h === "Actions" ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users?.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-accent/40">
                  <td className="px-4 py-2.5 font-medium">{u.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ROLE_BADGE[u.role] ?? ""}`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{u.phone || "-"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setMode("edit");
                          setEditing(u);
                          setDialogOpen(true);
                        }}
                        className="flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        onClick={() => toggleActive(u)}
                        className="flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                      >
                        <Power className="h-3 w-3" /> {u.isActive ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Fab
        label="New User"
        onClick={() => {
          setMode("create");
          setEditing(null);
          setDialogOpen(true);
        }}
      />

      <UserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={mode}
        value={editing}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
