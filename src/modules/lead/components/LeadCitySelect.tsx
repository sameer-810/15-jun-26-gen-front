import { useId } from "react";
import { useLeadCities } from "../hooks/useLeads";
import { useLocations } from "@/modules/location/useLocations";

/**
 * Location filter for the Leads list — point 9's "wherever location is added,
 * a dropdown instead of an input".
 *
 * Leads are not Inventory or Sales. Their city arrives from IndiaMART and is
 * whatever the buyer typed, so there are hundreds of them and the list has a
 * long tail: a closed dropdown would make real cities unsearchable, and a
 * 500-row select would be worse than typing.
 *
 * So this drops down like a dropdown — click it and the known locations and
 * cities are listed, master list first — but still accepts anything typed, so
 * a city that has just arrived from IndiaMART can be searched the moment it
 * lands. Inventory and Sales keep the strict `LocationSelect`, because there
 * the master list *is* the whole world.
 */
interface Props {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  "data-testid"?: string;
}

export function LeadCitySelect({ value, onChange, id, className, "data-testid": testId }: Props) {
  const listId = useId();
  const { data: cityFacets } = useLeadCities();
  const { data: master } = useLocations({ activeOnly: true, limit: 200 });

  const seen = new Set<string>();
  const options: string[] = [];
  for (const name of [
    ...(master?.items ?? []).map((l) => l.name),
    ...(cityFacets ?? []).map((c) => c.city),
  ]) {
    const key = name?.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    options.push(name);
  }

  return (
    <>
      <input
        id={id}
        data-testid={testId}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="All locations"
        className={className}
      />
      <datalist id={listId} data-testid={testId ? `${testId}-options` : undefined}>
        {options.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </>
  );
}
