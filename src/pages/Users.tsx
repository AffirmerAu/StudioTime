import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, LayoutGrid, Grid3x3 } from "lucide-react";
import { useClients, useProfiles, useProjects, useTimeLogs, useSchedule } from "../data/hooks";
import { Avatar, StatusBadge, Spinner } from "../components/ui";
import { TeamHeatmap } from "../components/TeamHeatmap";
import { fmtKey, addDays, TODAY } from "../lib/constants";
import { daysWaiting, waitingColor, isOverdue, DAILY_CAPACITY_DEFAULT } from "../lib/metrics";
import type { Profile, Project, ScheduleEntry } from "../lib/types";

const readView = (): "heatmap" | "cards" => {
  try { return localStorage.getItem("studiotime.usersView") === "heatmap" ? "heatmap" : "cards"; } catch { return "cards"; }
};

export function UsersPage() {
  const { data: profiles = [], isLoading } = useProfiles();
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: timeLogs = [] } = useTimeLogs();
  const { data: schedule = [] } = useSchedule();
  const [view, setView] = useState<"heatmap" | "cards">(readView);
  const setViewPersist = (v: "heatmap" | "cards") => { setView(v); try { localStorage.setItem("studiotime.usersView", v); } catch {} };

  if (isLoading) return <Spinner label="Loading users…" />;

  const artists = profiles.filter((p) => p.role === "artist").sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";
  const clientColor = (id: string | null) => clients.find((c) => c.id === id)?.color ?? "#64748b";

  // current week (Mon–Sun)
  const weekStart = (() => { const d = (TODAY.getDay() + 6) % 7; return addDays(TODAY, -d); })();
  const weekKeys = new Set(Array.from({ length: 7 }, (_, i) => fmtKey(addDays(weekStart, i))));

  const projTotal = (pid: string) => timeLogs.filter((l) => l.project_id === pid).reduce((a, l) => a + l.hours, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl" style={{ color: "#f1f5f9" }}>Users</h1>
          <p className="font-body text-sm mt-1" style={{ color: "#7b8a9a" }}>Workload and project overview for each team member.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: "#11181f", border: "1px solid #25323f" }}>
          <button onClick={() => setViewPersist("heatmap")} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-body"
            style={view === "heatmap" ? { background: "#e8795a", color: "#1a0d08" } : { color: "#9fb0c0" }}><Grid3x3 size={14} /> Heatmap</button>
          <button onClick={() => setViewPersist("cards")} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-body"
            style={view === "cards" ? { background: "#e8795a", color: "#1a0d08" } : { color: "#9fb0c0" }}><LayoutGrid size={14} /> Cards</button>
        </div>
      </div>

      {view === "heatmap" ? (
        <TeamHeatmap artists={artists} timeLogs={timeLogs} schedule={schedule} clients={clients} projects={projects} />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {artists.map((a) => <ArtistCard key={a.id} a={a} />)}
          {artists.length === 0 && <div className="font-body" style={{ color: "#475569" }}>No artists yet.</div>}
        </div>
      )}
    </div>
  );

  function ArtistCard({ a }: { a: Profile }) {
    const [showPast, setShowPast] = useState(false);
    const [wOff, setWOff] = useState(0);
    const capacity = a.daily_capacity_hours || DAILY_CAPACITY_DEFAULT;
    const mp = projects.filter((p) => p.users.includes(a.id));

    // Split current work: In production (Upcoming + In Production) vs Waiting on client (With Client).
    const inProduction = mp.filter((p) => !p.archived && (p.status === "Upcoming" || p.status === "In Production"))
      .sort((x, y) => x.name.localeCompare(y.name));
    const waitingOnClient = mp.filter((p) => !p.archived && p.status === "With Client")
      .sort((x, y) => (daysWaiting("With Client", y.client_review_date) ?? -1) - (daysWaiting("With Client", x.client_review_date) ?? -1));
    const past = mp.filter((p) => p.archived || p.status === "Closed");

    // Overdue: only work in the artist's hands (Upcoming/In Production) past its TARGET date.
    const overdueProjects = inProduction.filter((p) => isOverdue(p.status, p.target_date));
    const hoursThisWeek = timeLogs.filter((l) => l.user_id === a.id && weekKeys.has(l.log_date)).reduce((s, l) => s + l.hours, 0);

    const withEst = mp.filter((p) => p.estimated_hours > 0);
    let onTrack = 0, near = 0, over = 0;
    withEst.forEach((p) => { const r = projTotal(p.id) / p.estimated_hours; if (r > 1) over++; else if (r >= 0.8) near++; else onTrack++; });

    // daily bars
    const cardWeekStart = addDays(weekStart, wOff * 7);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(cardWeekStart, i));
    const dayHours = (d: Date) => timeLogs.filter((l) => l.user_id === a.id && l.log_date === fmtKey(d)).reduce((s, l) => s + l.hours, 0);
    const onLeave = (d: Date) => schedule.some((s: ScheduleEntry) => s.user_id === a.id && s.activity && s.start_date <= fmtKey(d) && s.end_date >= fmtKey(d));
    const bars = weekDays.map((d) => ({ d, h: dayHours(d) }));
    const weekTotal = bars.reduce((s, b) => s + b.h, 0);
    const weekCapacity = capacity * 5; // 5 working days
    const maxVal = Math.max(capacity, ...bars.map((b) => b.h), 1);
    const BAR_AREA = 46;
    const capacityFromBottom = (capacity / maxVal) * BAR_AREA;
    const weekLabel = wOff === 0 ? "This week" : `${weekDays[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${weekDays[6].toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;

    const Stat = ({ label, value, accent, title }: { label: string; value: string | number; accent?: string; title?: string }) => (
      <div className="rounded-lg p-2.5 text-center" title={title} style={{ background: "#11181f", border: "1px solid #1c2734" }}>
        <div className="font-mono text-lg" style={{ color: accent ?? "#e2e8f0" }}>{value}</div>
        <div className="font-body mt-0.5" style={{ fontSize: 10, color: "#7b8a9a" }}>{label}</div>
      </div>
    );

    const ProjRow = ({ p, waiting }: { p: Project; waiting?: number | null }) => (
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="rounded-full shrink-0" style={{ width: 7, height: 7, background: clientColor(p.client_id) }} />
          <span className="font-body text-sm truncate" style={{ color: "#dbe4ec" }}>{p.name}</span>
          <span className="font-body shrink-0" style={{ fontSize: 11, color: "#64748b" }}>{clientName(p.client_id)}</span>
        </div>
        {waiting != null && waiting > 0
          ? <span className="font-mono shrink-0" style={{ fontSize: 11, color: waitingColor(waiting) }}>Waiting {waiting} days</span>
          : <StatusBadge status={p.status} />}
      </div>
    );

    const List = ({ title, children, count }: { title: string; children: React.ReactNode; count: number }) => (
      <div>
        <div className="font-body text-xs uppercase tracking-wider mb-1.5" style={{ color: "#7b8a9a" }}>{title} ({count})</div>
        <div className="space-y-1">{count === 0 ? <div className="font-body text-sm" style={{ color: "#475569" }}>None.</div> : children}</div>
      </div>
    );

    return (
      <div className="rounded-xl border p-5 space-y-4" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
        <div className="flex items-center gap-3">
          <Avatar id={a.id} name={a.full_name ?? ""} size={40} color={a.avatar_color} />
          <div className="font-display text-lg" style={{ color: "#f1f5f9" }}>{a.full_name ?? "Unnamed"}</div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Stat label="In production" value={inProduction.length} />
          <Stat label="Waiting on client" value={waitingOnClient.length} />
          <Stat label="Hours this week" value={hoursThisWeek.toFixed(1)} />
          <Stat label="Overdue" value={overdueProjects.length} accent={overdueProjects.length > 0 ? "#f87171" : undefined}
            title={overdueProjects.length ? overdueProjects.map((p) => p.name).join(", ") : "No overdue projects"} />
        </div>

        {/* Daily bars */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-body text-xs uppercase tracking-wider" style={{ color: "#7b8a9a" }}>{weekLabel}</span>
            <span className="font-mono" style={{ fontSize: 11, color: "#9fb0c0" }}>{weekTotal.toFixed(1)} / {weekCapacity.toFixed(1)}h</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setWOff((w) => w - 1)} title="Previous week" className="rounded-md p-1 shrink-0" style={{ color: "#7b8a9a" }}><ChevronLeft size={14} /></button>
            <div className="flex-1">
              <div className="relative flex items-end gap-1.5" style={{ height: BAR_AREA + 16 }}>
                {/* capacity line across weekday columns */}
                <div className="absolute" style={{ left: 0, width: `${(5 / 7) * 100}%`, bottom: 14 + capacityFromBottom, borderTop: "1px dashed #46566a" }} />
                {bars.map(({ d, h }, i) => {
                  const dow = (d.getDay() + 6) % 7;
                  const weekend = dow >= 5;
                  const isToday = fmtKey(d) === fmtKey(TODAY);
                  const isPast = d < TODAY && !isToday;
                  const leave = onLeave(d);
                  const barH = Math.max((h / maxVal) * BAR_AREA, h > 0 ? 3 : 0);
                  let bg = "#1e2733"; let outline = "";
                  if (leave) bg = "transparent";
                  else if (h > 0) bg = h >= capacity ? "#4ade80" : (isPast && h < capacity * 0.5) ? "#fbbf24" : h < capacity ? "#7bd88f" : "#4ade80";
                  if (isPast && !weekend && !leave && h === 0) outline = "1px solid #f87171";
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                      <span className="font-body" style={{ fontSize: 9, color: h > 0 ? "#9fb0c0" : "transparent", height: 12 }}>{h > 0 ? h.toFixed(1) : "·"}</span>
                      {leave ? (
                        <div className="w-full rounded-sm" title="Leave" style={{ height: BAR_AREA, background: "repeating-linear-gradient(45deg,#2a3646,#2a3646 3px,transparent 3px,transparent 6px)", border: "1px solid #2a3646" }} />
                      ) : (
                        <div className="w-full rounded-sm" style={{ height: Math.max(barH, 2), background: weekend ? "#141c25" : bg, border: outline || undefined, opacity: weekend ? 0.5 : 1 }} />
                      )}
                      <span className="font-body mt-1" style={{ fontSize: 9, color: isToday ? "#e8795a" : weekend ? "#475569" : "#64748b" }}>{["M", "T", "W", "T", "F", "S", "S"][i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <button onClick={() => setWOff((w) => w + 1)} title="Next week" className="rounded-md p-1 shrink-0" style={{ color: "#7b8a9a" }}><ChevronRight size={14} /></button>
          </div>
        </div>

        {/* Budget health */}
        <div>
          <div className="font-body text-xs uppercase tracking-wider mb-2" style={{ color: "#7b8a9a" }}>Budget health</div>
          {withEst.length === 0 ? (
            <div className="font-body text-sm" style={{ color: "#475569" }}>No projects with an estimate.</div>
          ) : (
            <div className="space-y-1.5">
              {[{ label: "On track", n: onTrack, c: "#4ade80" }, { label: "Near", n: near, c: "#fbbf24" }, { label: "Over", n: over, c: "#f87171" }].map((b) => (
                <div key={b.label} className="flex items-center gap-2">
                  <span className="font-body" style={{ fontSize: 11, color: "#9fb0c0", width: 60 }}>{b.label}</span>
                  <div className="flex-1 h-3.5 rounded" style={{ background: "#11181f", overflow: "hidden" }}>
                    <div className="h-full" style={{ width: `${(b.n / withEst.length) * 100}%`, background: b.c }} />
                  </div>
                  <span className="font-mono" style={{ fontSize: 11, color: "#e2e8f0", width: 16, textAlign: "right" }}>{b.n}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <List title="In production" count={inProduction.length}>
          {inProduction.map((p) => <ProjRow key={p.id} p={p} />)}
        </List>
        <List title="Waiting on client" count={waitingOnClient.length}>
          {waitingOnClient.map((p) => <ProjRow key={p.id} p={p} waiting={daysWaiting("With Client", p.client_review_date)} />)}
        </List>

        <div>
          <button onClick={() => setShowPast((s) => !s)} className="flex items-center gap-1.5 font-body text-xs uppercase tracking-wider" style={{ color: "#7b8a9a" }}>
            {showPast ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Past projects ({past.length})
          </button>
          {showPast && (
            <div className="space-y-1 mt-2">
              {past.map((p) => <ProjRow key={p.id} p={p} />)}
              {past.length === 0 && <div className="font-body text-sm" style={{ color: "#475569" }}>None.</div>}
            </div>
          )}
        </div>
      </div>
    );
  }
}
