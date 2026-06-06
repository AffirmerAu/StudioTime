import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useClients, useProfiles, useProjects, useTimeLogs } from "../data/hooks";
import { Avatar, StatusBadge, Spinner } from "../components/ui";
import { fmtDMY, healthColor } from "../lib/constants";
import type { Project } from "../lib/types";

export function UsersPage() {
  const { data: profiles = [], isLoading } = useProfiles();
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: timeLogs = [] } = useTimeLogs();
  const [selected, setSelected] = useState<string | null>(null);

  if (isLoading) return <Spinner label="Loading users…" />;

  const artists = profiles.filter((p) => p.role === "artist").sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";

  // projects this user is a member of
  const projectsOf = (uid: string) => projects.filter((p) => p.users.includes(uid));
  // this user's own logged hours (all projects, all time)
  const userHours = (uid: string) => timeLogs.filter((l) => l.user_id === uid).reduce((a, l) => a + l.hours, 0);
  // this user's own hours on a specific project
  const userHoursOn = (uid: string, pid: string) => timeLogs.filter((l) => l.user_id === uid && l.project_id === pid).reduce((a, l) => a + l.hours, 0);
  // total hours logged on a project by anyone (for budget health)
  const projTotal = (pid: string) => timeLogs.filter((l) => l.project_id === pid).reduce((a, l) => a + l.hours, 0);

  if (!selected) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl" style={{ color: "#f1f5f9" }}>Users</h1>
          <p className="font-body text-sm mt-1" style={{ color: "#7b8a9a" }}>Workload and project overview for each team member.</p>
        </div>
        <div className="rounded-xl border overflow-hidden" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
          {artists.map((a, i) => {
            const mp = projectsOf(a.id);
            const active = mp.filter((p) => !p.archived && p.status !== "Closed").length;
            return (
              <button key={a.id} onClick={() => setSelected(a.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02]"
                style={{ borderTop: i === 0 ? "none" : "1px solid #141c25" }}>
                <Avatar id={a.id} name={a.full_name ?? ""} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="font-body" style={{ color: "#e2e8f0" }}>{a.full_name ?? "Unnamed"}</div>
                  <div className="font-body text-xs" style={{ color: "#7b8a9a" }}>{active} active project{active === 1 ? "" : "s"} · {userHours(a.id).toFixed(1)}h logged</div>
                </div>
                <ChevronRight size={16} style={{ color: "#475569" }} />
              </button>
            );
          })}
          {artists.length === 0 && <div className="px-4 py-8 text-center font-body" style={{ color: "#475569" }}>No artists yet.</div>}
        </div>
      </div>
    );
  }

  const a = artists.find((x) => x.id === selected);
  if (!a) { setSelected(null); return null; }
  const mp = projectsOf(a.id);
  const current = mp.filter((p) => !p.archived && p.status !== "Closed");
  const past = mp.filter((p) => p.archived || p.status === "Closed");

  // budget health bands across their projects with an estimate
  const withEst = mp.filter((p) => p.estimated_hours > 0);
  let onTrack = 0, near = 0, over = 0;
  withEst.forEach((p) => {
    const ratio = projTotal(p.id) / p.estimated_hours;
    if (ratio > 1) over++; else if (ratio >= 0.8) near++; else onTrack++;
  });

  // their hours by project (only projects they've logged to), descending
  const byProject = mp
    .map((p) => ({ p, h: userHoursOn(a.id, p.id) }))
    .filter((x) => x.h > 0)
    .sort((x, y) => y.h - x.h);
  const maxByProject = Math.max(1, ...byProject.map((x) => x.h));
  const totalHours = userHours(a.id);

  const ProjectRow = ({ p }: { p: Project }) => (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ borderTop: "1px solid #141c25" }}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: p.color ?? "#64748b" }} />
        <div className="min-w-0">
          <div className="font-body text-sm truncate" style={{ color: "#e2e8f0" }}>{p.name}</div>
          <div className="font-body text-xs" style={{ color: "#7b8a9a" }}>{clientName(p.client_id)}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-mono text-xs" style={{ color: "#9fb0c0" }}>{userHoursOn(a.id, p.id).toFixed(1)}h</span>
        <StatusBadge status={p.status} />
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <button onClick={() => setSelected(null)} className="inline-flex items-center gap-1.5 font-body text-sm" style={{ color: "#7b8a9a" }}>
        <ChevronLeft size={16} /> All users
      </button>

      <div className="flex items-center gap-4">
        <Avatar id={a.id} name={a.full_name ?? ""} size={52} />
        <div>
          <h1 className="font-display text-2xl" style={{ color: "#f1f5f9" }}>{a.full_name ?? "Unnamed"}</h1>
          <div className="font-body text-sm" style={{ color: "#7b8a9a", textTransform: "capitalize" }}>{a.role}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active projects", value: String(current.length) },
          { label: "Total hours logged", value: `${totalHours.toFixed(1)}h` },
          { label: "Projects over estimate", value: String(over), accent: over > 0 ? "#f87171" : "#e2e8f0" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border p-4" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
            <div className="font-body text-xs" style={{ color: "#7b8a9a" }}>{c.label}</div>
            <div className="font-mono text-2xl mt-1" style={{ color: (c as any).accent ?? "#e2e8f0" }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-5" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
        <div className="font-display text-base mb-1" style={{ color: "#e2e8f0" }}>Budget health</div>
        <div className="font-body text-xs mb-3" style={{ color: "#64748b" }}>Across their {withEst.length} project{withEst.length === 1 ? "" : "s"} with an estimate</div>
        {withEst.length === 0 ? (
          <div className="font-body text-sm" style={{ color: "#475569" }}>No projects with an estimate yet.</div>
        ) : (
          <div className="space-y-2.5">
            {[
              { label: "On track", n: onTrack, c: "#4ade80" },
              { label: "Near budget", n: near, c: "#fbbf24" },
              { label: "Over budget", n: over, c: "#f87171" },
            ].map((b) => (
              <div key={b.label} className="flex items-center gap-3">
                <span className="font-body text-xs" style={{ color: "#9fb0c0", width: 92 }}>{b.label}</span>
                <div className="flex-1 h-4 rounded" style={{ background: "#11181f", overflow: "hidden" }}>
                  <div className="h-full" style={{ width: `${(b.n / withEst.length) * 100}%`, background: b.c }} />
                </div>
                <span className="font-mono text-xs" style={{ color: "#e2e8f0", width: 20, textAlign: "right" }}>{b.n}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border p-5" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
        <div className="font-display text-base mb-3" style={{ color: "#e2e8f0" }}>Hours by project</div>
        {byProject.length === 0 ? (
          <div className="font-body text-sm" style={{ color: "#475569" }}>No time logged yet.</div>
        ) : (
          <div className="space-y-2.5">
            {byProject.map(({ p, h }) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="font-body text-xs truncate" style={{ color: "#9fb0c0", width: 130 }}>{p.name}</span>
                <div className="flex-1 h-4 rounded" style={{ background: "#11181f", overflow: "hidden" }}>
                  <div className="h-full rounded" style={{ width: `${(h / maxByProject) * 100}%`, background: p.color ?? "#e8795a" }} />
                </div>
                <span className="font-mono text-xs" style={{ color: "#e2e8f0", width: 44, textAlign: "right" }}>{h.toFixed(1)}h</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border overflow-hidden" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
          <div className="px-4 py-3 font-display text-base" style={{ color: "#e2e8f0" }}>Current projects <span className="font-body text-sm" style={{ color: "#64748b" }}>({current.length})</span></div>
          {current.map((p) => <ProjectRow key={p.id} p={p} />)}
          {current.length === 0 && <div className="px-4 py-6 text-center font-body text-sm" style={{ color: "#475569" }}>None.</div>}
        </div>
        <div className="rounded-xl border overflow-hidden" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
          <div className="px-4 py-3 font-display text-base" style={{ color: "#e2e8f0" }}>Past projects <span className="font-body text-sm" style={{ color: "#64748b" }}>({past.length})</span></div>
          {past.map((p) => <ProjectRow key={p.id} p={p} />)}
          {past.length === 0 && <div className="px-4 py-6 text-center font-body text-sm" style={{ color: "#475569" }}>None.</div>}
        </div>
      </div>
    </div>
  );
}
