/**
 * The one-tap reminder times, shared by the Manage Lead panel and the quick
 * sheets on the lead list so "Today" means the same thing in both.
 */

export function presetToday7pm() {
  const d = new Date();
  d.setHours(19, 0, 0, 0);
  // If 7pm has already passed, the sensible "today" slot is an hour from now.
  if (d.getTime() <= Date.now()) d.setTime(Date.now() + 60 * 60 * 1000);
  return d;
}

export function presetTomorrow10am() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

/** A Date → the value a datetime-local input expects, in local time. */
export function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
