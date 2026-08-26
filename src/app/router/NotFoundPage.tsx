import { Link, useLocation } from "react-router-dom";
import { Compass } from "lucide-react";

/**
 * A real 404, rather than redirecting unknown URLs to the dashboard.
 *
 * A silent redirect looks like the app working and hides the two cases that
 * matter — a stale bookmark, and a link that no longer resolves — which then
 * get reported as "it just goes to the dashboard".
 */
export function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted/40">
        <Compass className="h-5 w-5 text-muted-foreground" />
      </div>
      <h1 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
        There is no page here
      </h1>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        Nothing in the CRM answers to{" "}
        <span className="break-all font-mono text-foreground">{pathname}</span>. The link may be out
        of date, or the record it pointed at may have been deleted.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link
          to="/dashboard"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Go to dashboard
        </Link>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          Back
        </button>
      </div>
    </div>
  );
}
