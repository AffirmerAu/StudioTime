import type { ProjectStatus, TaskName } from "./types";

export const TASKS: TaskName[] = [
  "Storyboarding",
  "Blockout Premiere",
  "Production",
  "Internal Review",
  "Client Review",
];

export const STATUSES: ProjectStatus[] = ["Upcoming", "In Production", "With Client", "Closed"];

export const STATUS_STYLES: Record<ProjectStatus, { bg: string; fg: string; dot: string }> = {
  Upcoming: { bg: "rgba(96,165,250,0.15)", fg: "#93c5fd", dot: "#60a5fa" },
  "In Production": { bg: "rgba(251,191,36,0.15)", fg: "#fcd34d", dot: "#fbbf24" },
  "With Client": { bg: "rgba(192,132,252,0.16)", fg: "#d8b4fe", dot: "#c084fc" },
  Closed: { bg: "rgba(74,222,128,0.15)", fg: "#86efac", dot: "#4ade80" },
};

export const PROJECT_PALETTE = [
  "#e8795a", "#5e9cea", "#6ed0b8", "#d6a44f", "#b48be8",
  "#e87fa6", "#7cc36b", "#5fb9c9", "#d98559", "#9b8df0",
];

// Non-project scheduler items: no client, no assignment, no estimate. Just droppable blocks.
export const SCHEDULE_ACTIVITIES: { name: string; color: string }[] = [
  { name: "Annual Leave", color: "#5fb9c9" },
  { name: "Sick Leave", color: "#d98559" },
  { name: "Technical Support", color: "#9b8df0" },
];

// ---- date helpers (storage = ISO yyyy-mm-dd) ----
export const fmtKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDays = (base: Date, n: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
};
export const fmtDMY = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
export const fmtDM = (iso: string | null) => {
  if (!iso) return "—";
  const p = iso.split("-");
  return `${p[2]}/${p[1]}`;
};
export const TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

// ---- avatars ----
export const initialsOf = (name: string) =>
  name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const AVATAR_COLORS = ["#e8795a", "#5e9cea", "#6ed0b8", "#d6a44f", "#b48be8", "#e87fa6"];
export const avatarColor = (id: string) =>
  AVATAR_COLORS[(id.charCodeAt(id.length - 1) + id.length) % AVATAR_COLORS.length];

export const healthColor = (current: number, est: number) => {
  if (!est || est <= 0) return "#64748b";
  const r = current / est;
  if (r > 1) return "#f87171";
  if (r >= 0.8) return "#fbbf24";
  return "#4ade80";
};
