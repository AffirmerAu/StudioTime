import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Avatar } from "./ui";
import { fmtKey, addDays, TODAY } from "../lib/constants";
import { DAILY_CAPACITY_DEFAULT } from "../lib/metrics";
import type { Profile, TimeLog, ScheduleEntry, Client, Project } from "../lib/types";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

export function TeamHeatmap({ artists, timeLogs, schedule, clients, projects }: {
  artists: Profile[]; timeLogs: TimeLog[]; schedule: ScheduleEntry[]; clients: Client[]; projects: Project[];
}) {
  const projName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? "Project";
  const [span, setSpan] = useState(7); // 7 / 14 / 28
  const [offset, setOffset] = useState(0); // in spans
  const [drawer, setDrawer] = useState<{ user: Profile; date: Date } | null>(null);

  const weekStart = (() => { const d = (TODAY.getDay() + 6) % 7; return addDays(TODAY, -d); })();
  const start = addDays(weekStart, offset * span);
  const days = Array.from({ length: span }, (_, i) => addDays(start, i));
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";

  const hoursFor = (uid: string, d: Date) =>
    timeLogs.filter((l) => l.user_id === uid && l.log_date === fmtKey(d)).reduce((s, l) => s + l.hours, 0);
  const isLeave = (uid: string, d: Date) =>
    schedule.some((s) => s.user_id === uid && s.activity && s.start_date <= fmtKey(d) && s.end_date >= fmtKey(d));

  const cellColor = (uid: string, d: Date, cap: number): { bg: string; hatch?: boolean } => {
    const dow = (d.getDay() + 6) % 7;
    const weekend = dow >= 5;
    const isToday = fmtKey(d) === fmtKey(TODAY);
    const isPast = d < TODAY && !isToday;
    if (isLeave(uid, d)) return { bg: "#2a3646", hatch: true };
    const h = hoursFor(uid, d);
    if (weekend) return { bg: h > 0 ? "#3b6d4a" : "#0d131a" };
    if (h === 0) return { bg: isPast ? "rgba(248,113,113,0.35)" : "#0d131a" };
    const pct = h / cap;
    if (pct < 0.5) return { bg: "rgba(251,191,36,0.5)" };
    if (pct < 1) return { bg: "rgba(74,222,128,0.4)" };
    return { bg: "#4ade80" };
  };

  const spanLabel = `${days[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${days[days.length - 1].toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 flex-wrap" style={{ borderBottom: "1px solid #1c2734" }}>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setOffset((o) => o - 1)} className="rounded-md p-1" style={{ color: "#9fb0c0" }}><ChevronLeft size={16} /></button>
          <span className="font-body text-sm" style={{ color: "#e2e8f0", minWidth: 130, textAlign: "center" }}>{spanLabel}</span>
          <button onClick={() => setOffset((o) => o + 1)} className="rounded-md p-1" style={{ color: "#9fb0c0" }}><ChevronRight size={16} /></button>
          {offset !== 0 && <button onClick={() => setOffset(0)} className="font-body text-xs ml-1" style={{ color: "#7b8a9a" }}>Today</button>}
        </div>
        <div className="flex items-center gap-1">
          {[{ v: 7, l: "1w" }, { v: 14, l: "2w" }, { v: 28, l: "4w" }].map((s) => (
            <button key={s.v} onClick={() => { setSpan(s.v); setOffset(0); }}
              className="rounded-md px-2.5 py-1 text-xs font-body"
              style={span === s.v ? { background: "#e8795a", color: "#1a0d08" } : { background: "#161f29", color: "#9fb0c0", border: "1px solid #25323f" }}>{s.l}</button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="text-sm font-body" style={{ borderCollapse: "collapse", minWidth: span > 7 ? 640 : undefined, width: "100%" }}>
          <thead>
            <tr>
              <th className="px-3 py-2 text-left sticky left-0" style={{ background: "#0f151d", color: "#7b8a9a", fontSize: 11 }}>Artist</th>
              {days.map((d, i) => {
                const dow = (d.getDay() + 6) % 7;
                const isToday = fmtKey(d) === fmtKey(TODAY);
                return (
                  <th key={i} className="px-0 py-2 text-center" style={{ minWidth: 26, color: isToday ? "#e8795a" : dow >= 5 ? "#475569" : "#7b8a9a", fontSize: 10 }}>
                    <div>{DOW[dow]}</div><div className="font-mono">{d.getDate()}</div>
                  </th>
                );
              })}
              <th className="px-3 py-2 text-right" style={{ color: "#7b8a9a", fontSize: 11 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {artists.map((a) => {
              const cap = a.daily_capacity_hours || DAILY_CAPACITY_DEFAULT;
              const total = days.reduce((s, d) => s + hoursFor(a.id, d), 0);
              const weekdays = days.filter((d) => ((d.getDay() + 6) % 7) < 5).length;
              const util = weekdays > 0 ? Math.round((total / (cap * weekdays)) * 100) : 0;
              return (
                <tr key={a.id} style={{ borderTop: "1px solid #141c25" }}>
                  <td className="px-3 py-1.5 sticky left-0" style={{ background: "#0f151d" }}>
                    <div className="flex items-center gap-2">
                      <Avatar id={a.id} name={a.full_name ?? ""} size={22} color={a.avatar_color} />
                      <span className="font-body text-xs truncate" style={{ color: "#dbe4ec", maxWidth: 90 }}>{(a.full_name ?? "").split(" ")[0]}</span>
                    </div>
                  </td>
                  {days.map((d, i) => {
                    const { bg, hatch } = cellColor(a.id, d, cap);
                    const h = hoursFor(a.id, d);
                    return (
                      <td key={i} className="p-0.5 text-center">
                        <button onClick={() => setDrawer({ user: a, date: d })} title={`${a.full_name} · ${d.toLocaleDateString()} · ${h.toFixed(1)}h`}
                          className="w-full rounded" style={{
                            height: 26, background: hatch ? "repeating-linear-gradient(45deg,#2a3646,#2a3646 3px,transparent 3px,transparent 6px)" : bg,
                            border: hatch ? "1px solid #2a3646" : "none", color: h >= (a.daily_capacity_hours || 7.6) ? "#0b0f14" : "#cbd5e1", fontSize: 9,
                          }}>{h > 0 ? h.toFixed(1) : ""}</button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    <span className="font-mono text-xs" style={{ color: "#e2e8f0" }}>{total.toFixed(1)}h</span>
                    <span className="font-mono ml-1" style={{ fontSize: 10, color: util >= 100 ? "#4ade80" : util >= 50 ? "#9fb0c0" : "#fbbf24" }}>{util}%</span>
                  </td>
                </tr>
              );
            })}
            {artists.length === 0 && <tr><td colSpan={span + 2} className="px-3 py-6 text-center" style={{ color: "#475569" }}>No artists.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5" style={{ borderTop: "1px solid #1c2734", fontSize: 10, color: "#7b8a9a" }}>
        {[["rgba(248,113,113,0.35)", "0h (past)"], ["rgba(251,191,36,0.5)", "<50%"], ["rgba(74,222,128,0.4)", "50–99%"], ["#4ade80", "100%+"]].map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-1.5"><span className="rounded" style={{ width: 12, height: 12, background: c }} />{l}</span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="rounded" style={{ width: 12, height: 12, background: "repeating-linear-gradient(45deg,#2a3646,#2a3646 3px,transparent 3px,transparent 6px)", border: "1px solid #2a3646" }} />Leave</span>
      </div>

      {drawer && <DayDrawer user={drawer.user} date={drawer.date} timeLogs={timeLogs} labelFor={(l) => l.activity ?? projName(l.project_id)} onClose={() => setDrawer(null)} />}
    </div>
  );
}

function DayDrawer({ user, date, timeLogs, labelFor, onClose }: {
  user: Profile; date: Date; timeLogs: TimeLog[]; labelFor: (l: TimeLog) => string; onClose: () => void;
}) {
  const entries = timeLogs.filter((l) => l.user_id === user.id && l.log_date === fmtKey(date));
  const total = entries.reduce((s, l) => s + l.hours, 0);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="h-full w-full max-w-sm p-5 overflow-y-auto" style={{ background: "#0f151d", borderLeft: "1px solid #1c2734" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-lg" style={{ color: "#f1f5f9" }}>{user.full_name}</h3>
          <button onClick={onClose} className="rounded-md p-1" style={{ color: "#7b8a9a" }}><X size={18} /></button>
        </div>
        <div className="font-body text-sm mb-4" style={{ color: "#7b8a9a" }}>
          {date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} · {total.toFixed(1)}h
        </div>
        {entries.length === 0 ? (
          <div className="font-body text-sm" style={{ color: "#475569" }}>No time logged this day.</div>
        ) : (
          <div className="space-y-2">
            {entries.map((l) => (
              <div key={l.id} className="rounded-lg p-3" style={{ background: "#11181f", border: "1px solid #1c2734" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-body text-sm" style={{ color: "#e2e8f0", fontStyle: l.activity ? "italic" : "normal" }}>{labelFor(l)}</span>
                  <span className="font-mono text-sm" style={{ color: "#e2e8f0" }}>{l.hours.toFixed(1)}h</span>
                </div>
                {!l.activity && l.task && <div className="font-body" style={{ fontSize: 11, color: "#64748b" }}>{l.task}</div>}
                {l.notes && <div className="font-body text-xs mt-1" style={{ color: "#9fb0c0" }}>{l.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

