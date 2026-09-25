import { useState } from "react";
import { Clock3, TrendingUp, AlertCircle, ChevronRight } from "lucide-react";
import { StatusBadge } from "./ui";
import { STATUSES, fmtDM, fmtKey } from "../lib/constants";
import {
  daysWaiting, waitingColor, overrunHours, overrunPct, isStale, fmtHours, daysSince, todaySydney,
} from "../lib/metrics";
import type { Project, Client, Profile, TimeLog, ScheduleEntry } from "../lib/types";

const nameOfClient = (clients: Client[], id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";

// ---- Panel shell ----------------------------------------------------------
function Panel({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  const [showAll, setShowAll] = useState(false);
  const items = Array.isArray(children) ? children : [children];
  const shown = showAll ? items : items.slice(0, 5);
  return (
    <div className="rounded-xl border flex flex-col" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid #1c2734" }}>
        <span className="font-display text-sm" style={{ color: "#e2e8f0" }}>{title}</span>
        <span className="font-mono text-xs rounded-full px-2 py-0.5" style={{ background: "#161f29", color: "#9fb0c0" }}>{count}</span>
      </div>
      <div className="p-2 flex-1">
        {count === 0 ? (
          <div className="px-2 py-6 text-center font-body text-sm" style={{ color: "#475569" }}>{empty}</div>
        ) : (
          <div className="space-y-1">{shown}</div>
        )}
        {count > 5 && (
          <button onClick={() => setShowAll((v) => !v)} className="mt-1 w-full text-center font-body text-xs py-1.5" style={{ color: "#7b8a9a" }}>
            {showAll ? "Show less" : `Show all ${count}`}
          </button>
        )}
      </div>
    </div>
  );
}

const Row = ({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) => (
  <div onClick={onClick} className={`rounded-lg px-3 py-2 ${onClick ? "cursor-pointer" : ""}`}
    style={{ background: "#11181f", border: "1px solid #1c2734" }}>{children}</div>
);

export function NeedsAttention({ projects, clients, profiles, timeLogs, schedule, onOpenProject, onStatusChange }: {
  projects: Project[]; clients: Client[]; profiles: Profile[]; timeLogs: TimeLog[]; schedule: ScheduleEntry[];
  onOpenProject: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const live = projects.filter((p) => !p.archived);
  const lastLog = (pid: string) => {
    const ds = timeLogs.filter((l) => l.project_id === pid).map((l) => l.log_date).sort();
    return ds.length ? ds[ds.length - 1] : null;
  };

  // Panel 1 — Waiting on client
  const waiting = live
    .map((p) => ({ p, days: daysWaiting(p.status, p.client_review_date) }))
    .filter((x) => x.days !== null)
    .sort((a, b) => b.days! - a.days!);

  // Panel 2 — Biggest overruns
  const overruns = live
    .filter((p) => p.status !== "Closed")
    .map((p) => ({ p, logged: timeLogs.filter((l) => l.project_id === p.id).reduce((a, l) => a + l.hours, 0) }))
    .filter((x) => x.logged > x.p.estimated_hours && x.p.estimated_hours >= 0 && x.logged - x.p.estimated_hours > 0)
    .sort((a, b) => overrunHours(b.logged, b.p.estimated_hours) - overrunHours(a.logged, a.p.estimated_hours));

  // Panel 3 — Stale projects + missing timesheets
  const stale = live.filter((p) => isStale(p.status, lastLog(p.id)));

  // Missing timesheets: past weekdays in the last 5 working days with 0h and no leave.
  const workingDays: string[] = [];
  { let d = todaySydney(); let guard = 0;
    while (workingDays.length < 5 && guard < 20) {
      d = new Date(d.getTime() - 86_400_000); guard++;
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) workingDays.push(fmtKey(d));
    }
  }
  const artists = profiles.filter((p) => p.role === "artist");
  const onLeave = (uid: string, key: string) =>
    schedule.some((s) => s.user_id === uid && s.activity && s.start_date <= key && s.end_date >= key);
  const missing = artists.map((a) => {
    const days = workingDays.filter((k) =>
      timeLogs.filter((l) => l.user_id === a.id && l.log_date === k).reduce((s, l) => s + l.hours, 0) === 0 && !onLeave(a.id, k));
    return { a, days };
  }).filter((x) => x.days.length > 0);

  const staleCount = stale.length + missing.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-base" style={{ color: "#e2e8f0" }}>Needs attention</h2>
        <button onClick={() => onOpenProject("__all__")} className="inline-flex items-center gap-1 font-body text-sm" style={{ color: "#7b8a9a" }}>
          All projects <ChevronRight size={15} />
        </button>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <Panel title="Waiting on client" count={waiting.length} empty="Nothing waiting on a client.">
          {waiting.map(({ p, days }) => (
            <Row key={p.id} onClick={() => onOpenProject(p.id)}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-body text-sm truncate" style={{ color: "#e2e8f0" }}>{p.name}</div>
                  <div className="font-body" style={{ fontSize: 11, color: "#64748b" }}>{nameOfClient(clients, p.client_id)} · sent {fmtDM(p.client_review_date)}</div>
                </div>
                <span className="font-mono text-xs shrink-0" style={{ color: waitingColor(days!) }}>Waiting {days} days</span>
              </div>
            </Row>
          ))}
        </Panel>

        <Panel title="Biggest overruns" count={overruns.length} empty="No projects over estimate.">
          {overruns.map(({ p, logged }) => {
            const oh = overrunHours(logged, p.estimated_hours);
            const pct = overrunPct(logged, p.estimated_hours);
            return (
              <Row key={p.id} onClick={() => onOpenProject(p.id)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-body text-sm truncate" style={{ color: "#e2e8f0" }}>{p.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5"><StatusBadge status={p.status} /><span className="font-body" style={{ fontSize: 11, color: "#64748b" }}>{nameOfClient(clients, p.client_id)}</span></div>
                  </div>
                  <span className="font-mono text-xs shrink-0" style={{ color: "#f87171" }}>+{fmtHours(oh)}h{pct !== null ? ` (${pct >= 0 ? "+" : ""}${Math.round(pct)}%)` : ""}</span>
                </div>
              </Row>
            );
          })}
        </Panel>

        <Panel title="Stale & missing" count={staleCount} empty="Everything up to date.">
          {[
            ...stale.map((p) => (
              <Row key={`s-${p.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-body text-sm truncate" style={{ color: "#e2e8f0" }} onClick={() => onOpenProject(p.id)}>{p.name}</div>
                    <div className="font-body" style={{ fontSize: 11, color: "#64748b" }}>In Production · no time since {lastLog(p.id) ? fmtDM(lastLog(p.id)) : "ever"}</div>
                  </div>
                  <select value={p.status} onClick={(e) => e.stopPropagation()} onChange={(e) => onStatusChange(p.id, e.target.value)}
                    className="rounded-md px-1.5 py-1 text-xs font-body shrink-0" style={{ background: "#0a0f15", border: "1px solid #25323f", color: "#cbd5e1" }}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </Row>
            )),
            ...missing.map(({ a, days }) => (
              <Row key={`m-${a.id}`}>
                <div className="font-body text-sm" style={{ color: "#e2e8f0" }}>{a.full_name ?? "Unnamed"}</div>
                <div className="font-body" style={{ fontSize: 11, color: "#fbbf24" }}>No time: {days.map((k) => fmtDM(k)).join(", ")}</div>
              </Row>
            )),
          ]}
        </Panel>
      </div>
    </div>
  );
}
