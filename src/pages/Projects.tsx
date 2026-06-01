import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Pencil, Archive, ArchiveRestore, Search } from "lucide-react";
import { useClients, useProfiles, useProjects, useProjectMutations, useTimeLogs } from "../data/hooks";
import { Avatar, PrimaryButton, ProgressBar, StatusBadge, Spinner } from "../components/ui";
import { ProjectModal } from "../components/ProjectModal";
import { STATUSES, fmtDMY } from "../lib/constants";
import type { Project } from "../lib/types";

export function Projects() {
  const nav = useNavigate();
  const { data: projects = [], isLoading } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: profiles = [] } = useProfiles();
  const { data: timeLogs = [] } = useTimeLogs();
  const { setArchived } = useProjectMutations();

  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchParams] = useSearchParams();
  const [clientFilter, setClientFilter] = useState(searchParams.get("client") ?? "All");
  const [modal, setModal] = useState<{ mode: "add" | "edit"; project: Project | null } | null>(null);

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";
  const sumHours = (pid: string) => timeLogs.filter((l) => l.project_id === pid).reduce((a, l) => a + l.hours, 0);

  const visible = projects
    .filter((p) => showArchived || !p.archived)
    .filter((p) => statusFilter === "All" || p.status === statusFilter)
    .filter((p) => clientFilter === "All" || p.client_id === clientFilter)
    .filter((p) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return p.name.toLowerCase().includes(q) || clientName(p.client_id).toLowerCase().includes(q);
    });

  if (isLoading) return <Spinner label="Loading projects…" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1" style={{ minWidth: 180 }}>
          <Search size={14} className="absolute top-1/2 left-2.5" style={{ transform: "translateY(-50%)", color: "#64748b" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects or clients…"
            className="w-full rounded-lg pl-8 pr-3 py-1.5 text-sm font-body" style={{ background: "#0a0f15", border: "1px solid #25323f", color: "#e2e8f0" }} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg px-2.5 py-1.5 text-sm font-body" style={{ background: "#0a0f15", border: "1px solid #25323f", color: "#cbd5e1" }}>
          {["All", ...STATUSES].map((s) => <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>)}
        </select>
        <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="rounded-lg px-2.5 py-1.5 text-sm font-body" style={{ background: "#0a0f15", border: "1px solid #25323f", color: "#cbd5e1" }}>
          <option value="All">All clients</option>
          {clients.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm font-body cursor-pointer select-none" style={{ color: "#9fb0c0" }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Archived
        </label>
        <PrimaryButton onClick={() => setModal({ mode: "add", project: null })}><Plus size={16} /> Add Project</PrimaryButton>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="text-left" style={{ color: "#7b8a9a" }}>
                {["Project", "Client", "Status", "Team", "Hours", "Review", "Video min", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 font-medium text-xs uppercase tracking-wider whitespace-nowrap" style={{ borderBottom: "1px solid #1c2734" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const cur = sumHours(p.id);
                const over = cur > p.estimated_hours;
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid #141c25", opacity: p.archived ? 0.5 : 1 }}>
                    <td className="px-4 py-3">
                      <button className="flex items-center gap-2 hover:underline" style={{ color: "#e2e8f0" }} onClick={() => nav(`/projects/${p.id}`)}>
                        <span className="rounded-full" style={{ width: 8, height: 8, background: p.color ?? "#64748b" }} />
                        <span className="font-medium">{p.name}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3" style={{ color: "#9fb0c0" }}>{clientName(p.client_id)}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3">
                      {p.users.length === 0 ? <span className="text-xs" style={{ color: "#475569" }}>—</span> : (
                        <div className="flex -space-x-1.5">
                          {p.users.slice(0, 4).map((uid) => {
                            const u = profiles.find((x) => x.id === uid);
                            return u ? <Avatar key={uid} id={uid} name={u.full_name ?? ""} size={24} ring /> : null;
                          })}
                          {p.users.length > 4 && (
                            <span className="inline-flex items-center justify-center rounded-full font-body" style={{ width: 24, height: 24, fontSize: 10, background: "#1e2733", color: "#9fb0c0", boxShadow: "0 0 0 2px #0d1117" }}>+{p.users.length - 4}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3" style={{ minWidth: 150 }}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1"><ProgressBar current={cur} est={p.estimated_hours} /></div>
                        <span className="font-mono text-xs whitespace-nowrap" style={{ color: over ? "#f87171" : "#9fb0c0" }}>{cur.toFixed(1)}/{p.estimated_hours}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "#7b8a9a" }}>{fmtDMY(p.client_review_date)}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "#7b8a9a" }}>{p.video_minutes ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button title="Edit" onClick={() => setModal({ mode: "edit", project: p })} className="rounded-md p-1.5" style={{ color: "#7b8a9a" }}><Pencil size={15} /></button>
                        <button title={p.archived ? "Restore" : "Archive"} onClick={() => setArchived.mutate({ id: p.id, archived: !p.archived })} className="rounded-md p-1.5" style={{ color: "#7b8a9a" }}>
                          {p.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center font-body" style={{ color: "#475569" }}>No projects match your filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modal && <ProjectModal mode={modal.mode} project={modal.project} clients={clients} onClose={() => setModal(null)} />}
    </div>
  );
}
