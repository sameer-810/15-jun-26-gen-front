import { useEffect, useState } from "react";

/**
 * Subscribe to a media query.
 *
 * Initialised from `matchMedia` rather than from a default, so the first paint
 * is already correct. A hook that starts `false` and corrects on mount renders
 * the desktop table for one frame on every phone load, which on a slow device
 * is a visible flash of an 800px grid before the cards replace it.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * Below Tailwind's `md`. The single breakpoint the mobile layer switches on.
 *
 * One breakpoint, not a ladder: the app has a phone layout and a desktop
 * layout, and a tablet in portrait is a big phone as far as a data table is
 * concerned — 768px still cannot hold ten columns without panning.
 *
 * Kept in sync with `Sidebar`, which watches the same 768px line.
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
