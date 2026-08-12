import { useLocations } from "./useLocations";

/**
 * Location dropdown fed by the master list — change request (11 Aug) point 9,
 * replacing the free-text box that let one yard be spelled three ways.
 *
 * A value that is not (or is no longer) in the list is kept as an extra option
 * rather than silently cleared, so opening an old record does not wipe its
 * location on save.
 */
interface Props {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  /** Adds an "All locations" entry — for filter bars. */
  allowAll?: boolean;
  placeholder?: string;
  "data-testid"?: string;
}

export function LocationSelect({
  value,
  onChange,
  id,
  className,
  allowAll,
  placeholder = "— Select location —",
  "data-testid": testId,
}: Props) {
  const { data, isLoading } = useLocations({ activeOnly: true, limit: 200 });
  const options = data?.items ?? [];
  const known = options.some((l) => l.name === value);

  return (
    <select
      id={id}
      data-testid={testId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        "w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
      }
    >
      <option value="">{allowAll ? "All locations" : placeholder}</option>
      {options.map((l) => (
        <option key={l.id} value={l.name}>
          {l.name}
          {l.city ? ` — ${l.city}` : ""}
        </option>
      ))}
      {/* Preserve a legacy or deactivated value instead of dropping it. */}
      {value && !known && !isLoading && <option value={value}>{value} (not in list)</option>}
    </select>
  );
}
