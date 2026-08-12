import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { FormDialog } from "@/modules/common/FormDialog";
import { http } from "@/shared/api/http";
import { downloadAuthenticatedFile } from "@/shared/lib/downloadFile";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";

/**
 * Bulk lead import — change request (11 Aug) point 7: "In import lead option I
 * need data format instruction before adding the leads."
 *
 * The instructions are fetched from the server rather than written here, so the
 * documented contract and the parser can never drift apart.
 */

type ImportSpec = {
  columns: { column: string; required: boolean; description: string; example: string }[];
  notes: string[];
};

type ImportResult = {
  created: number;
  skipped: number;
  total: number;
  errors: { row: number; message: string }[];
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function LeadImportDialog({ open, onOpenChange, onSuccess }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: spec } = useQuery({
    queryKey: ["leads", "import-spec"],
    queryFn: async () => {
      const res = await http.get<{ data: ImportSpec }>("/leads/import/spec");
      return res.data.data;
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  async function downloadTemplate() {
    try {
      await downloadAuthenticatedFile("/leads/import/template", "lead-import-template.xlsx");
      toast.success("Template downloaded");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const res = await http.post<{ data: ImportResult; message: string }>("/leads/import", {
        fileBase64: base64,
      });
      setResult(res.data.data);
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success(res.data.message);
      onSuccess?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Import leads from a spreadsheet"
      size="xl"
      hideFooter
    >
      <div className="space-y-4" data-testid="lead-import">
        {/* Instructions first — the point of this dialog. */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">BEFORE YOU IMPORT</h3>
          <ul className="space-y-1 text-xs text-foreground">
            {spec?.notes.map((n) => (
              <li key={n} className="flex gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                {["Column", "Required", "What goes in it", "Example"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {spec?.columns.map((c) => (
                <tr key={c.column}>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono font-medium">
                    {c.column}
                  </td>
                  <td className="px-3 py-1.5">
                    {c.required ? (
                      <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive">
                        Required
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Optional</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{c.description || "—"}</td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">{c.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            data-testid="download-import-template"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Download className="h-4 w-4" /> Download template
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFileChosen}
            className="hidden"
            data-testid="lead-import-file"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            data-testid="choose-import-file"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" /> {busy ? "Importing..." : "Choose file & import"}
          </button>
        </div>

        {result && (
          <div className="space-y-2" data-testid="import-result">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                {result.created} of {result.total} row(s) imported
                {result.skipped ? `, ${result.skipped} skipped` : ""}.
              </span>
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" /> Rows that were skipped
                </div>
                <ul className="space-y-0.5 text-xs text-amber-900 dark:text-amber-300">
                  {result.errors.map((e) => (
                    <li key={`${e.row}-${e.message}`}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </FormDialog>
  );
}
