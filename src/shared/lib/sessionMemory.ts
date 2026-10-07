/**
 * What a screen should remember for the life of the tab: which page of a list
 * you were on, its filters, how far down you had scrolled, a call you had just
 * placed and not yet marked.
 *
 * It lives in sessionStorage rather than component state because component
 * state is lost in exactly the two moments a salesperson needs it kept:
 *
 *  - **opening a lead and coming back** — the list screen is rebuilt, and used
 *    to return at page 1, scrolled to the top, with its filters cleared;
 *  - **the phone reloading the tab** — Android discards a background tab to free
 *    memory, which is what happens while the dialler is in front. Coming back
 *    from a call then reloads the page.
 *
 * Per tab on purpose, not localStorage: a second tab is a second piece of work.
 * Storage can be unavailable (private mode, quota), so every access is guarded
 * and the screen simply forgets.
 */
const PREFIX = "srf.mem.";

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readMemory<T>(key: string, fallback: T): T {
  try {
    const raw = storage()?.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeMemory(key: string, value: unknown) {
  try {
    storage()?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Nothing to do: the screen forgets, which is what it did before.
  }
}

/** Forget one key, or with no argument everything this module has stored. */
export function clearMemory(key?: string) {
  try {
    const s = storage();
    if (!s) return;
    if (key) {
      s.removeItem(PREFIX + key);
      return;
    }
    for (let i = s.length - 1; i >= 0; i--) {
      const k = s.key(i);
      if (k?.startsWith(PREFIX)) s.removeItem(k);
    }
  } catch {
    // As above.
  }
}
