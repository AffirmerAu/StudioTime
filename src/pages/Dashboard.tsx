import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell,
} from "recharts";
import {
  FolderKanban, Clock, CircleAlert, Hourglass,
} from "lucide-react";
import { useClients, useProfiles, useProjects, useProjectMutations, useTimeLogs, useSchedule } from "../data/hooks";
import { SummaryCard, Spinner } from "../components/ui";
import { NeedsAttention } from "../components/NeedsAttention";
import { STATUSES, TODAY, fmtDM } from "../lib/constants";
import { CHART_COLORS } from "../lib/metrics";
import type { Project } from "../lib/types";

export function Dashboard() {
  const nav = useNavigate();
  const { data: projects = [], isLoading } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: profiles = [] } = useProfiles();
  const { data: timeLogs = [] } = useTimeLogs();
  const { data: schedule = [] } = useSchedule();
  const { setStatus } = useProjectMutations();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [showClosed, setShowClosed] = useState(false);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "status", dir: "asc" });

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
  const withClient = active.filter((p) => p.status === "With Client").length;

  const chartData = useMemo(() =>
    active.filter((p) => p.status === "In Production")
      .map((p) => ({ name: p.name.length > 16 ? p.name.slice(0, 15) + "…" : p.name, Estimated: p.estimated_hours, Current: +sumHours(p.id).toFixed(1) }))
      .sort((a, b) => b.Current - a.Current).slice(0, 5),
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
    if (statusFilter.size > 0) r = r.filter((p) => statusFilter.has(p.status));
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
    { key: "review", label: "Client Review Date", sortable: true },
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
        <SummaryCard icon={Hourglass} label="With client" value={withClient} sub="status is With Client" accent="#c084fc" />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
        <div className="px-5 pt-4 pb-2"><h2 className="font-display text-base" style={{ color: "#e2e8f0" }}>Top projects in production — estimated vs logged</h2></div>
        <div style={{ height: 260 }} className="px-2 pb-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2734" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#7b8a9a", fontSize: 11 }} stroke="#22303d" interval={0} angle={-12} textAnchor="end" height={50} />
              <YAxis tick={{ fill: "#7b8a9a", fontSize: 11 }} stroke="#22303d" />
              <Tooltip contentStyle={{ background: "#0b0f14", border: "1px solid #25323f", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "#e2e8f0" }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#9fb0c0" }}
                payload={[
                  { value: "Logged within estimate", type: "square", id: "within", color: CHART_COLORS.within },
                  { value: "Remaining estimate", type: "square", id: "remaining", color: CHART_COLORS.remaining },
                  { value: "Over estimate", type: "square", id: "over", color: CHART_COLORS.over },
                ]} />
              <Bar dataKey="Estimated" fill={CHART_COLORS.remaining} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Current" radius={[3, 3, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.Current > d.Estimated ? CHART_COLORS.over : CHART_COLORS.within} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <NeedsAttention
        projects={projects} clients={clients} profiles={profiles} timeLogs={timeLogs} schedule={schedule}
        onOpenProject={(id) => nav(id === "__all__" ? "/projects" : `/projects/${id}`)}
        onStatusChange={(id, status) => setStatus.mutate({ id, status })}
      />
    </div>
  );
}
