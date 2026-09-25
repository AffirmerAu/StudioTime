import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LabelList,
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

  // Horizontal stacked-bar data: one row per In Production project, sorted by overrun, top 10.
  const chartData = useMemo(() =>
    active.filter((p) => p.status === "In Production")
      .map((p) => {
        const logged = +sumHours(p.id).toFixed(1);
        const est = p.estimated_hours;
        const within = Math.min(logged, est);
        const remaining = Math.max(0, est - logged);
        const over = Math.max(0, logged - est);
        return { id: p.id, name: p.name, client: clientName(p.client_id), logged, est, within, remaining, over, overrun: logged - est };
      })
      .sort((a, b) => b.overrun - a.overrun)
      .slice(0, 10),
    [projects, timeLogs, clients]);

  // Y-axis tick: project name wrapped to two lines, client underneath in muted text.
  const renderTick = (props: any) => {
    const { x, y, payload } = props;
    const row = chartData.find((d) => d.name === payload.value);
    const words = payload.value.split(" ");
    const lines: string[] = []; let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > 26 && cur) { lines.push(cur); cur = w; } else { cur = (cur + " " + w).trim(); }
      if (lines.length === 2) break;
    }
    if (cur && lines.length < 2) lines.push(cur);
    if (words.join(" ").length > lines.join(" ").length) lines[1] = (lines[1] ?? "") + "…";
    const topY = y - (lines.length === 2 ? 8 : 2);
    return (
      <g transform={`translate(${x - 8},${topY})`} textAnchor="end">
        {lines.map((ln, i) => <text key={i} x={0} y={i * 13} fontSize={12} fill="#e2e8f0" className="font-body">{ln}</text>)}
        <text x={0} y={lines.length * 13} fontSize={10} fill="#64748b" className="font-body">{row?.client}</text>
      </g>
    );
  };

  // Value label at the end of each bar.
  const renderEndLabel = (props: any) => {
    const { x = 0, width = 0, y = 0, height = 0, index } = props;
    const row = chartData[index]; if (!row) return null;
    const label = row.over > 0
      ? `${row.logged.toFixed(1)} / ${row.est}h · +${row.over.toFixed(1)}h`
      : `${row.logged.toFixed(1)} / ${row.est}h`;
    return (
      <text x={x + width + 8} y={y + height / 2} dominantBaseline="central" fontSize={11}
        fill={row.over > 0 ? "#f87171" : "#9fb0c0"} className="font-mono">{label}</text>
    );
  };

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
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <h2 className="font-display text-base" style={{ color: "#e2e8f0" }}>In production — logged vs estimate</h2>
          <button onClick={() => nav("/projects")} className="font-body text-sm" style={{ color: "#7b8a9a" }}>View all →</button>
        </div>
        {chartData.length === 0 ? (
          <div className="px-5 pb-6 pt-2 font-body text-sm" style={{ color: "#475569" }}>No projects in production.</div>
        ) : (
          <div className="px-2 pb-3" style={{ height: Math.max(160, chartData.length * 46 + 48) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 130, left: 8, bottom: 8 }} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2734" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#7b8a9a", fontSize: 11 }} stroke="#22303d" />
                <YAxis type="category" dataKey="name" width={220} tickLine={false} axisLine={false}
                  tick={renderTick} interval={0} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#9fb0c0" }}
                  payload={[
                    { value: "Logged within estimate", type: "square", id: "within", color: CHART_COLORS.within },
                    { value: "Estimated Time", type: "square", id: "remaining", color: CHART_COLORS.remaining },
                    { value: "Over estimate", type: "square", id: "over", color: CHART_COLORS.over },
                  ]} />
                <Bar dataKey="within" stackId="h" fill={CHART_COLORS.within} radius={[3, 0, 0, 3]} onClick={(d: any) => nav(`/projects/${d.id}`)} cursor="pointer" />
                <Bar dataKey="remaining" stackId="h" fill={CHART_COLORS.remaining} onClick={(d: any) => nav(`/projects/${d.id}`)} cursor="pointer" />
                <Bar dataKey="over" stackId="h" fill={CHART_COLORS.over} radius={[0, 3, 3, 0]} onClick={(d: any) => nav(`/projects/${d.id}`)} cursor="pointer">
                  <LabelList content={renderEndLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <NeedsAttention
        projects={projects} clients={clients} profiles={profiles} timeLogs={timeLogs} schedule={schedule}
        onOpenProject={(id) => nav(id === "__all__" ? "/projects" : `/projects/${id}`)}
        onStatusChange={(id, status) => setStatus.mutate({ id, status })}
      />
    </div>
  );
}

// Tooltip for the horizontal chart: logged, estimate, overrun hours and %.
function ChartTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const pct = r.est > 0 ? Math.round(((r.logged - r.est) / r.est) * 100) : null;
  return (
    <div style={{ background: "#0b0f14", border: "1px solid #25323f", borderRadius: 10, padding: "8px 10px", fontSize: 12 }}>
      <div className="font-body" style={{ color: "#e2e8f0", marginBottom: 2 }}>{r.name}</div>
      <div className="font-body" style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>{r.client}</div>
      <div className="font-mono" style={{ color: "#9fb0c0" }}>Logged {r.logged.toFixed(1)}h · Estimate {r.est}h</div>
      {r.overrun > 0
        ? <div className="font-mono" style={{ color: "#f87171" }}>Over {r.overrun.toFixed(1)}h{pct !== null ? ` (+${pct}%)` : ""}</div>
        : <div className="font-mono" style={{ color: "#4ade80" }}>{r.est > 0 ? `${Math.round((r.logged / r.est) * 100)}% used` : "No estimate"}</div>}
    </div>
  );
}
