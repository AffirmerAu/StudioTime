// Shared metric definitions for the admin reporting screens.
// Every screen imports from here so the same figure is calculated the same way.
// All date maths uses the Australia/Sydney local date (not UTC), per spec.

export const DAILY_CAPACITY_DEFAULT = 7.6;

// Colour tokens shared by the dashboard chart bars AND its legend, so they never drift.
export const CHART_COLORS = {
  within: "#4ade80",     // logged, up to the estimate (green)
  remaining: "#3b4a5a",  // estimate not yet used (grey)
  over: "#f87171",       // logged beyond the estimate (red)
};

// Budget band colours (On track / Near / Over).
export const BAND_COLORS: Record<BudgetBand, string> = {
  "on-track": "#4ade80",
  near: "#fbbf24",
  over: "#f87171",
};

export type BudgetBand = "on-track" | "near" | "over";

// ---- Sydney "today" -------------------------------------------------------
// Returns today's calendar date in Australia/Sydney as 'YYYY-MM-DD', regardless
// of where the code runs. Compare ISO date strings against this.
export function todayKeySydney(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

// Sydney today as a Date at local midnight, for day-difference maths.
export function todaySydney(): Date {
  const [y, m, d] = todayKeySydney().split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Whole days between an ISO date and Sydney today (positive = in the past).
export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const then = new Date(y, m - 1, d);
  return Math.round((todaySydney().getTime() - then.getTime()) / 86_400_000);
}

// ---- Hours / budget -------------------------------------------------------
export const fmtHours = (n: number) => n.toFixed(1);

export function overrunHours(logged: number, estimate: number): number {
  return logged - estimate;
}

// (logged − estimate) ÷ estimate × 100; null when estimate is 0.
export function overrunPct(logged: number, estimate: number): number | null {
  if (!estimate || estimate <= 0) return null;
  return ((logged - estimate) / estimate) * 100;
}

export function budgetBand(logged: number, estimate: number): BudgetBand {
  if (!estimate || estimate <= 0) return "on-track";
  const r = logged / estimate;
  if (r > 1) return "over";
  if (r >= 0.8) return "near";
  return "on-track";
}

// ---- Status-derived states ------------------------------------------------
// Days a project has been waiting on the client: only when status is With Client
// and the review date is before today. Returns null otherwise.
export function daysWaiting(status: string, reviewDate: string | null): number | null {
  if (status !== "With Client" || !reviewDate) return null;
  const d = daysSince(reviewDate);
  return d !== null && d > 0 ? d : null;
}

// Colour band for a days-waiting figure: 0–7 muted, 8–21 amber, 22+ red.
export function waitingColor(days: number): string {
  if (days >= 22) return "#f87171";
  if (days >= 8) return "#fbbf24";
  return "#7b8a9a";
}

// Stale: In Production with no time logged in 14 days. Upcoming is never stale.
// `lastLogDate` is the ISO date of the project's most recent time entry (or null).
export function isStale(status: string, lastLogDate: string | null): boolean {
  if (status !== "In Production") return false;
  const d = daysSince(lastLogDate);
  return d === null || d >= 14; // no logs at all, or none in 14 days
}

// Overdue: Upcoming or In Production with a target date before today.
// No target date means never overdue.
export function isOverdue(status: string, targetDate: string | null): boolean {
  if (status !== "Upcoming" && status !== "In Production") return false;
  const d = daysSince(targetDate);
  return d !== null && d > 0;
}

export function overdueDays(targetDate: string | null): number | null {
  const d = daysSince(targetDate);
  return d !== null && d > 0 ? d : null;
}
