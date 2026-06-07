import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell,
} from "recharts";
import {
  FolderKanban, Clock, CircleAlert, AlertTriangle, Search, ArrowUp, ArrowDown, ArrowUpDown, Pencil, Archive,
} from "lucide-react";
import { useClients, useProfiles, useProjects, useProjectMutations, useTimeLogs } from "../data/hooks";
import { Avatar, ProgressBar, StatusBadge, SummaryCard, Spinner } from "../components/ui";
import { ProjectModal } from "../components/ProjectModal";
import { STATUSES, TODAY, fmtDM } from "../lib/constants";
import type { Project } from "../lib/types";

export function Dashboard() {
  const nav = useNavigate();
  const { data: projects = [], isLoading } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: profiles = [] } = useProfiles();
  const { data: timeLogs = [] } = useTimeLogs();
  const { setArchived } = useProjectMutations();
  const [modal, setModal] = useState<{ mode: "add" | "edit"; project: Project | null } | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showClosed, setShowClosed] = useState(false);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });

  const sumHours = (pid: string) => timeLogs.filter((l) => l.project_id === pid).reduce((a, l) => a + l.hours, 0);
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";
  const reviewOverdue = (p: Project) => !!p.client_review_date && p.status !== "Closed" && new Date(p.client_review_date + "T00:00:00") < TODAY;

  const active = projects.filter((p) => !p.archived);
  const totalActive = active.filter((p) => p.status !== "Closed").length;
  const monthHours = useMemo(() => {
    const m = TODAY.getMonth(), y = TODAY.getFullYear();
    return timeLogs.reduce((acc, l) => {
      const d = new Date(l.log_date + "T00:00:00");
      return d.getMonth() === m && d.getFullYear() === y ? acc + l.hours : acc;
    }, 0);
  }, [timeLogs]);
  const overBudget = active.filter((p) => sumHours(p.id) > p.estimated_hours).length;
  const overdue = active.filter(reviewOverdue).length;

  const chartData = useMemo(() =>
    active.map((p) => ({ name: p.name.length > 16 ? p.name.slice(0, 15) + "…" : p.name, Estimated: p.estimated_hours, Current: +sumHours(p.id).toFixed(1) }))
      .sort((a, b) => b.Current - a.Current).slice(0, 8),
    [projects, timeLogs]);

  const sortVal = (p: Project, key: string): string | number => {
    switch (key) {
      case "name": return p.name.toLowerCase();
      case "client": return clientName(p.client_id).toLowerCase();
      case "status": return STATUSES.indexOf(p.status);
      case "hours": return sumHours(p.id);
      case "start": return p.start_date ?? "";
      case "review": return p.client_review_date ?? "";
      case "video": return p.video_minutes ?? -1;
      default: return "";
    }
  };
  const rows = useMemo(() => {
    let r = active;
    if (!showClosed) r = r.filter((p) => p.status !== "Closed");
    if (statusFilter !== "All") r = r.filter((p) => p.status === statusFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter((p) => p.name.toLowerCase().includes(q) || clientName(p.client_id).toLowerCase().includes(q));
    }
    return [...r].sort((a, b) => {
      const va = sortVal(a, sort.key), vb = sortVal(b, sort.key);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [projects, timeLogs, showClosed, statusFilter, query, sort]);

  const toggleSort = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const COLS: { key: string | null; label: string; sortable: boolean }[] = [
    { key: "name", label: "Project", sortable: true },
    { key: "client", label: "Client", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: null, label: "Team", sortable: false },
    { key: "hours", label: "Hours", sortable: true },
    { key: "start", label: "Start date", sortable: true },
    { key: "review", label: "Review date", sortable: true },
    { key: "video", label: "Video min", sortable: true },
    { key: null, label: "", sortable: false },
  ];

  if (isLoading) return <Spinner label="Loading projects…" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={FolderKanban} label="Active Projects" value={totalActive} sub={`${active.length} total`} accent="#5e9cea" />
        <SummaryCard icon={Clock} label="Logged this month" value={`${monthHours.toFixed(1)}h`} sub="across all projects" accent="#6ed0b8" />
        <SummaryCard icon={CircleAlert} label="Over Budget" value={overBudget} sub="hours exceed estimate" accent="#f87171" />
        <SummaryCard icon={AlertTriangle} label="Number of projects overdue" value={overdue} sub="review date passed" accent="#fbbf24" />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
        <div className="px-5 pt-4 pb-2"><h2 className="font-display text-base" style={{ color: "#e2e8f0" }}>Top projects — estimated vs logged</h2></div>
        <div style={{ height: 260 }} className="px-2 pb-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2734" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#7b8a9a", fontSize: 11 }} stroke="#22303d" interval={0} angle={-12} textAnchor="end" height={50} />
              <YAxis tick={{ fill: "#7b8a9a", fontSize: 11 }} stroke="#22303d" />
              <Tooltip contentStyle={{ background: "#0b0f14", border: "1px solid #25323f", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "#e2e8f0" }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#9fb0c0" }} />
              <Bar dataKey="Estimated" fill="#3b4a5a" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Current" radius={[3, 3, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.Current > d.Estimated ? "#f87171" : "#4ade80"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #1c2734" }}>
          <div className="relative flex-1" style={{ minWidth: 160 }}>
            <Search size={14} className="absolute top-1/2 left-2.5" style={{ transform: "translateY(-50%)", color: "#64748b" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects or clients…"
              className="w-full rounded-lg pl-8 pr-3 py-1.5 text-sm font-body" style={{ background: "#0a0f15", border: "1px solid #25323f", color: "#e2e8f0" }} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg px-2.5 py-1.5 text-sm font-body" style={{ background: "#0a0f15", border: "1px solid #25323f", color: "#cbd5e1" }}>
            {["All", ...STATUSES].map((s) => <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>)}
          </select>
          <button onClick={() => setShowClosed((v) => !v)} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium font-body"
            style={{ background: showClosed ? "rgba(74,222,128,0.14)" : "#161f29", color: showClosed ? "#86efac" : "#cbd5e1", border: `1px solid ${showClosed ? "#2f7a4f" : "#25323f"}` }}>
            {showClosed ? "Hide" : "Show"} closed
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr className="text-left" style={{ color: "#7b8a9a" }}>
                {COLS.map((c) => (
                  <th key={c.label} onClick={c.sortable ? () => toggleSort(c.key!) : undefined}
                    className={`px-4 py-3 font-medium text-xs uppercase tracking-wider whitespace-nowrap ${c.sortable ? "cursor-pointer select-none" : ""}`}
                    style={{ borderBottom: "1px solid #1c2734", color: c.sortable && sort.key === c.key ? "#e8795a" : undefined }}>
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {c.sortable && (sort.key === c.key ? (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} style={{ opacity: 0.4 }} />)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const cur = sumHours(p.id);
                const over = cur > p.estimated_hours;
                const rp = reviewOverdue(p);
                const rowBg = over ? "rgba(248,113,113,0.07)" : rp ? "rgba(251,191,36,0.07)" : "transparent";
                return (
                  <tr key={p.id} onClick={() => nav(`/projects/${p.id}`)} className="cursor-pointer"
                    style={{ background: rowBg, borderBottom: "1px solid #141c25" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full" style={{ width: 8, height: 8, background: p.color ?? "#64748b" }} />
                        <span style={{ color: "#e2e8f0" }} className="font-medium">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: "#9fb0c0" }}>{clientName(p.client_id)}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex -space-x-1.5">
                        {p.users.slice(0, 4).map((uid) => {
                          const u = profiles.find((x) => x.id === uid);
                          return u ? <Avatar key={uid} id={uid} name={u.full_name ?? ""} size={24} ring /> : null;
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ minWidth: 150 }}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1"><ProgressBar current={cur} est={p.estimated_hours} /></div>
                        <span className="font-mono text-xs whitespace-nowrap" style={{ color: over ? "#f87171" : "#9fb0c0" }}>{cur.toFixed(1)}/{p.estimated_hours}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "#7b8a9a" }}>{fmtDM(p.start_date)}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: rp ? "#fcd34d" : "#7b8a9a" }}>{fmtDM(p.client_review_date)}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "#7b8a9a" }}>{p.video_minutes ?? "—"}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <button title="Edit" onClick={() => setModal({ mode: "edit", project: p })} className="rounded-md p-1.5" style={{ color: "#7b8a9a" }}><Pencil size={15} /></button>
                        <button title="Archive" onClick={() => setArchived.mutate({ id: p.id, archived: true })} className="rounded-md p-1.5" style={{ color: "#7b8a9a" }}><Archive size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center font-body" style={{ color: "#475569" }}>No projects match your filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modal && <ProjectModal mode={modal.mode} project={modal.project} clients={clients} onClose={() => setModal(null)} />}
    </div>
  );
}
