import { useClients, useProfiles, useProjects, useTimeLogs } from "../data/hooks";
import { Avatar, StatusBadge, Spinner } from "../components/ui";
import { fmtKey, addDays, TODAY } from "../lib/constants";
import type { Profile, Project } from "../lib/types";

export function UsersPage() {
  const { data: profiles = [], isLoading } = useProfiles();
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: timeLogs = [] } = useTimeLogs();

  if (isLoading) return <Spinner label="Loading users…" />;

  const artists = profiles.filter((p) => p.role === "artist").sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";

  // current week (Mon–Sun)
  const weekStart = (() => { const d = (TODAY.getDay() + 6) % 7; return addDays(TODAY, -d); })();
  const weekKeys = new Set(Array.from({ length: 7 }, (_, i) => fmtKey(addDays(weekStart, i))));

  const projTotal = (pid: string) => timeLogs.filter((l) => l.project_id === pid).reduce((a, l) => a + l.hours, 0);
  const reviewOverdue = (p: Project) => !!p.client_review_date && p.status !== "Closed" && new Date(p.client_review_date + "T00:00:00") < TODAY;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl" style={{ color: "#f1f5f9" }}>Users</h1>
        <p className="font-body text-sm mt-1" style={{ color: "#7b8a9a" }}>Workload and project overview for each team member.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {artists.map((a) => <ArtistCard key={a.id} a={a} />)}
        {artists.length === 0 && <div className="font-body" style={{ color: "#475569" }}>No artists yet.</div>}
      </div>
    </div>
  );

  function ArtistCard({ a }: { a: Profile }) {
    const mp = projects.filter((p) => p.users.includes(a.id));
    const current = mp.filter((p) => !p.archived && p.status !== "Closed");
    const past = mp.filter((p) => p.archived || p.status === "Closed");
    const hoursThisWeek = timeLogs.filter((l) => l.user_id === a.id && weekKeys.has(l.log_date)).reduce((s, l) => s + l.hours, 0);
    const overdue = current.filter(reviewOverdue).length;

    const withEst = mp.filter((p) => p.estimated_hours > 0);
    let onTrack = 0, near = 0, over = 0;
    withEst.forEach((p) => { const r = projTotal(p.id) / p.estimated_hours; if (r > 1) over++; else if (r >= 0.8) near++; else onTrack++; });

    // mini "My Week" bars (Mon–Sun) so a manager can see if they logged hours each day
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const dayHours = (d: Date) => timeLogs.filter((l) => l.user_id === a.id && l.log_date === fmtKey(d)).reduce((s, l) => s + l.hours, 0);
    const weekBars = weekDays.map(dayHours);
    const maxDay = Math.max(8, ...weekBars);

    const Stat = ({ label, value, accent }: { label: string; value: string | number; accent?: string }) => (
      <div className="rounded-lg p-3 text-center" style={{ background: "#11181f", border: "1px solid #1c2734" }}>
        <div className="font-mono text-xl" style={{ color: accent ?? "#e2e8f0" }}>{value}</div>
        <div className="font-body mt-0.5" style={{ fontSize: 11, color: "#7b8a9a" }}>{label}</div>
      </div>
    );
    const ProjList = ({ title, items }: { title: string; items: Project[] }) => (
      <div>
        <div className="font-body text-xs uppercase tracking-wider mb-1.5" style={{ color: "#7b8a9a" }}>{title} ({items.length})</div>
        <div className="space-y-1">
          {items.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="rounded-full shrink-0" style={{ width: 7, height: 7, background: p.color ?? "#64748b" }} />
                <span className="font-body text-sm truncate" style={{ color: "#dbe4ec" }}>{p.name}</span>
                <span className="font-body shrink-0" style={{ fontSize: 11, color: "#64748b" }}>{clientName(p.client_id)}</span>
              </div>
              <StatusBadge status={p.status} />
            </div>
          ))}
          {items.length === 0 && <div className="font-body text-sm" style={{ color: "#475569" }}>None.</div>}
        </div>
      </div>
    );

    return (
      <div className="rounded-xl border p-5 space-y-4" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
        <div className="flex items-center gap-3">
          <Avatar id={a.id} name={a.full_name ?? ""} size={40} />
          <div className="font-display text-lg" style={{ color: "#f1f5f9" }}>{a.full_name ?? "Unnamed"}</div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Active projects" value={current.length} />
          <Stat label="Hours this week" value={hoursThisWeek.toFixed(1)} />
          <Stat label="Overdue projects" value={overdue} accent={overdue > 0 ? "#f87171" : undefined} />
        </div>

        <div>
          <div className="font-body text-xs uppercase tracking-wider mb-1.5" style={{ color: "#7b8a9a" }}>This week</div>
          <div className="flex items-end gap-1.5" style={{ height: 46 }}>
            {weekBars.map((h, i) => {
              const isToday = fmtKey(weekDays[i]) === fmtKey(TODAY);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div className="w-full rounded-sm" style={{ height: `${Math.max((h / maxDay) * 32, h > 0 ? 4 : 2)}px`, background: h <= 0 ? "#1e2733" : h < 8 ? "#4ade80" : "#e8795a" }} />
                  <span className="font-body" style={{ fontSize: 9, color: isToday ? "#e8795a" : "#64748b" }}>{["M", "T", "W", "T", "F", "S", "S"][i]}</span>
                </div>
              );
            })}
          </div>
        </div>

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

        <ProjList title="Current projects" items={current} />
        <ProjList title="Past projects" items={past} />
      </div>
    );
  }
}
