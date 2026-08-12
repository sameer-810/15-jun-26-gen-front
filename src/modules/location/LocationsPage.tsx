import { useState } from "react";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import { FormDialog } from "@/modules/common/FormDialog";
import {
  useLocations,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
  useSeedLocations,
  type Location,
} from "./useLocations";
import { useAppSelector } from "@/app/hooks";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { PageLoader } from "@/shared/components/PageLoader";

/**
 * The branch / godown master list behind the Location dropdowns
 * (change request 11 Aug, point 9).
 */

const inputCls =
  "w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";

export function LocationsPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const canManage = role === "admin" || role === "manager" || role === "inventory";
  const canDelete = role === "admin";

  const { data, isLoading } = useLocations({ limit: 200 });
  const createMutation = useCreateLocation();
  const updateMutation = useUpdateLocation();
  const deleteMutation = useDeleteLocation();
  const seedMutation = useSeedLocations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Location | null>(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    contactPerson: "",
    mobile: "",
    isActive: true,
  });

  function openEditor(location: Location | null) {
    setEditing(location);
    setForm({
      name: location?.name ?? "",
      address: location?.address ?? "",
      city: location?.city ?? "",
      state: location?.state ?? "",
      contactPerson: location?.contactPerson ?? "",
      mobile: location?.mobile ?? "",
      isActive: location?.isActive ?? true,
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Give the location a name");
      return;
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          payload: { ...form, name: form.name.trim() },
        });
        toast.success("Location updated");
      } else {
        await createMutation.mutateAsync({ ...form, name: form.name.trim() });
        toast.success("Location created");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function remove() {
    if (!confirmDelete) return;
    try {
      await deleteMutation.mutateAsync(confirmDelete.id);
      toast.success("Location deleted");
      setConfirmDelete(null);
    } catch (err) {
      // The server refuses while stock or sales still reference it, and says so.
      toast.error(getApiErrorMessage(err));
    }
  }

  async function seed() {
    try {
      const result = await seedMutation.mutateAsync();
      toast.success(
        result.created
          ? `Imported ${result.created} location(s) from existing records`
          : "Nothing new to import — every location is already listed",
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="erp-page" data-testid="locations-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Locations</h1>
          <p className="text-sm text-muted-foreground">
            Branches and godowns · {data?.meta.total ?? 0} records · used by the Location dropdowns
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={seed}
              disabled={seedMutation.isPending}
              data-testid="seed-locations"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
              title="Create master entries from locations already typed into stock and sales"
            >
              <Download className="h-4 w-4" /> Import from existing
            </button>
            <button
              onClick={() => openEditor(null)}
              data-testid="new-location"
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> New Location
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !data?.items.length ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No locations yet. Add one, or import the locations already typed into stock and sales.
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                {["Actions", "Name", "City", "State", "Contact", "In use", "Status"].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    {canManage ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditor(l)}
                          className="flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => setConfirmDelete(l)}
                            data-testid={`delete-location-${l.id}`}
                            className="flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">View only</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{l.name}</td>
                  <td className="px-4 py-2.5">{l.city || "-"}</td>
                  <td className="px-4 py-2.5">{l.state || "-"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {[l.contactPerson, l.mobile].filter(Boolean).join(" · ") || "-"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {l.usage ? `${l.usage.inventory} stock · ${l.usage.sales} sales` : "-"}
                  </td>
                  <td className="px-4 py-2.5">
                    {l.isActive ? (
                      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                        Inactive
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit Location" : "New Location"}
        size="md"
        onSubmit={save}
        isPending={createMutation.isPending || updateMutation.isPending}
        submitLabel={editing ? "Save Changes" : "Create Location"}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              className="mb-1 block text-xs font-medium text-muted-foreground"
              htmlFor="loc-name"
            >
              Name *
            </label>
            <input
              id="loc-name"
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Mumbai Yard"
            />
            {editing && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Renaming updates the stock and sales rows already stamped with the old name.
              </p>
            )}
          </div>
          {(
            [
              ["city", "City"],
              ["state", "State"],
              ["contactPerson", "Contact person"],
              ["mobile", "Mobile"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label
                className="mb-1 block text-xs font-medium text-muted-foreground"
                htmlFor={`loc-${key}`}
              >
                {label}
              </label>
              <input
                id={`loc-${key}`}
                className={inputCls}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label
              className="mb-1 block text-xs font-medium text-muted-foreground"
              htmlFor="loc-address"
            >
              Address
            </label>
            <input
              id="loc-address"
              className={inputCls}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Active — offered in the Location dropdowns
          </label>
        </div>
      </FormDialog>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-foreground">Delete location</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Delete “{confirmDelete.name}”?
              {confirmDelete.usage?.total
                ? " It is still used by existing records, so this will be refused — deactivate it instead."
                : ""}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={remove}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
