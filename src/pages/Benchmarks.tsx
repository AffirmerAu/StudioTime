import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { useClients, useProjects, useTimeLogs, useProjectMutations } from "../data/hooks";
import { Spinner, Label, fieldCls, fieldStyle, DateField } from "../components/ui";
import type { Project } from "../lib/types";

const ACTUAL = "#e8795a";
const ESTIMATE = "#3b4a5a";

function percentile(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = p * (sortedAsc.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

export function Benchmarks() {
  const { data: clients = [], isLoading } = useClients();
  const { data: projects = [] } = useProjects();
  const { data: timeLogs = [] } = useTimeLogs();
  const { patch } = useProjectMutations();

  const [includeWithClient, setIncludeWithClient] = useState(false);
  const [clientFilter, setClientFilter] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loggedOf = (pid: string) => timeLogs.filter((l) => l.project_id === pid).reduce((a, l) => a + l.hours, 0);
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";
  const clientColor = (id: string | null) => clients.find((c) => c.id === id)?.color ?? "#64748b";

  // Eligible projects with per-project figures
  const eligible = useMemo(() => {
    const statuses = includeWithClient ? ["Closed", "With Client"] : ["Closed"];
    return projects
      .filter((p) => statuses.includes(p.status))
      .filter((p) => !p.exclude_from_benchmarks)
      .filter((p) => (p.video_minutes ?? 0) > 0 && loggedOf(p.id) > 0)
      .filter((p) => clientFilter === "All" || p.client_id === clientFilter)
      .filter((p) => !from || (p.start_date ?? "") >= from)
      .filter((p) => !to || (p.start_date ?? "") <= to)
      .map((p) => {
        const logged = loggedOf(p.id);
        const mins = p.video_minutes ?? 0;
        return { p, logged, mins, estimate: p.estimated_hours, actualHM: logged / mins, estHM: mins > 0 ? p.estimated_hours / mins : 0 };
      });
  }, [projects, timeLogs, includeWithClient, clientFilter, from, to]);

  // Group by client
  const groups = useMemo(() => {
    const byClient = new Map<string, typeof eligible>();
    eligible.forEach((e) => {
      const k = e.p.client_id ?? "none";
      if (!byClient.has(k)) byClient.set(k, []);
      byClient.get(k)!.push(e);
    });
    const rows = Array.from(byClient.entries()).map(([cid, items]) => {
      const mins = items.reduce((s, i) => s + i.mins, 0);
      const logged = items.reduce((s, i) => s + i.logged, 0);
      const estimate = items.reduce((s, i) => s + i.estimate, 0);
      return {
        cid, name: cid === "none" ? "No client" : clientName(cid), color: clientColor(cid === "none" ? null : cid),
        count: items.length, mins, logged, estimate,
        actualHM: mins > 0 ? logged / mins : 0, estHM: mins > 0 ? estimate / mins : 0, items,
      };
    }).sort((a, b) => b.logged - a.logged);
    return rows;
  }, [eligible]);

  // All-clients total
  const total = useMemo(() => {
    const mins = eligible.reduce((s, i) => s + i.mins, 0);
    const logged = eligible.reduce((s, i) => s + i.logged, 0);
    const estimate = eligible.reduce((s, i) => s + i.estimate, 0);
    return { count: eligible.length, mins, logged, estimate, actualHM: mins > 0 ? logged / mins : 0, estHM: mins > 0 ? estimate / mins : 0 };
  }, [eligible]);

  const chartData = groups.map((g) => ({ name: g.name, Actual: +g.actualHM.toFixed(2), Estimated: +g.estHM.toFixed(2) }));

  if (isLoading) return <Spinner label="Loading benchmarks…" />;

  const variance = (actual: number, est: number) => est > 0 ? Math.round(((actual - est) / est) * 100) : null;
  const toggleExpand = (cid: string) => setExpanded((prev) => { const n = new Set(prev); n.has(cid) ? n.delete(cid) : n.add(cid); return n; });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl" style={{ color: "#f1f5f9" }}>Benchmarks</h1>
        <p className="font-body text-sm mt-1" style={{ color: "#7b8a9a" }}>Hours per finished video minute, so estimates can be based on what past projects actually took.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border p-4" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
        <div><Label>Client</Label>
          <select className={fieldCls} style={{ ...fieldStyle, minWidth: 160 }} value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
            <option value="All">All clients</option>
            {clients.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><Label>From</Label><DateField value={from} onChange={setFrom} clearable placeholder="Any" /></div>
        <div><Label>To</Label><DateField value={to} onChange={setTo} clearable placeholder="Any" /></div>
        <label className="flex items-center gap-2 text-sm font-body cursor-pointer select-none pb-2" style={{ color: "#9fb0c0" }}>
          <input type="checkbox" checked={includeWithClient} onChange={(e) => setIncludeWithClient(e.target.checked)} /> Include With Client
        </label>
      </div>

      {eligible.length === 0 ? (
        <div className="rounded-xl border px-4 py-10 text-center font-body" style={{ background: "#0f151d", borderColor: "#1c2734", color: "#475569" }}>
          No projects match these filters. Benchmarks use Closed projects with video minutes and logged hours.
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="rounded-xl border overflow-hidden" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
            <div className="px-5 pt-4 pb-1"><h2 className="font-display text-base" style={{ color: "#e2e8f0" }}>Hours per video minute — actual vs estimated</h2></div>
            <div className="px-2 pb-3" style={{ height: Math.max(160, chartData.length * 44 + 48) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }} barCategoryGap="24%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2734" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#7b8a9a", fontSize: 11 }} stroke="#22303d" />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fill: "#cbd5e1", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#0b0f14", border: "1px solid #25323f", borderRadius: 10, fontSize: 12 }} cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    formatter={(v: any, n: any) => [`${v} h/min`, n]} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#9fb0c0" }} />
                  <Bar dataKey="Actual" fill={ACTUAL} radius={[0, 3, 3, 0]} />
                  <Bar dataKey="Estimated" fill={ESTIMATE} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border overflow-hidden" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="text-left" style={{ color: "#7b8a9a" }}>
                    {["Client", "Projects", "Video min", "Hours logged", "Actual h/min", "Est. h/min", "Variance"].map((h, i) => (
                      <th key={i} className="px-4 py-3 font-medium text-xs uppercase tracking-wider whitespace-nowrap" style={{ borderBottom: "1px solid #1c2734", textAlign: i === 0 ? "left" : "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => {
                    const v = variance(g.actualHM, g.estHM);
                    const open = expanded.has(g.cid);
                    return (
                      <>
                        <tr key={g.cid} onClick={() => toggleExpand(g.cid)} className="cursor-pointer" style={{ borderBottom: "1px solid #141c25" }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2" style={{ color: "#e2e8f0" }}>
                              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              <span className="rounded-full shrink-0" style={{ width: 9, height: 9, background: g.color }} />
                              <span className="font-medium">{g.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-right" style={{ color: g.count < 3 ? "#64748b" : "#e2e8f0" }} title={g.count < 3 ? "Low sample" : undefined}>{g.count}</td>
                          <td className="px-4 py-3 font-mono text-right" style={{ color: "#9fb0c0" }}>{g.mins.toFixed(0)}</td>
                          <td className="px-4 py-3 font-mono text-right" style={{ color: "#9fb0c0" }}>{g.logged.toFixed(1)}</td>
                          <td className="px-4 py-3 font-mono text-right" style={{ color: "#e2e8f0" }}>{g.actualHM.toFixed(2)}</td>
                          <td className="px-4 py-3 font-mono text-right" style={{ color: "#9fb0c0" }}>{g.estHM.toFixed(2)}</td>
                          <td className="px-4 py-3 font-mono text-right" style={{ color: v === null ? "#475569" : v > 0 ? "#f87171" : "#4ade80" }}>{v === null ? "—" : `${v >= 0 ? "+" : ""}${v}%`}</td>
                        </tr>
                        {open && g.items.map(({ p, logged, mins, estimate, actualHM, estHM }) => {
                          const pv = variance(actualHM, estHM);
                          return (
                            <tr key={p.id} style={{ borderBottom: "1px solid #141c25", background: "#0b1017" }}>
                              <td className="px-4 py-2 pl-12">
                                <div className="flex items-center gap-2">
                                  <span className="font-body text-sm" style={{ color: "#cbd5e1" }}>{p.name}</span>
                                  <label className="flex items-center gap-1 ml-2 font-body cursor-pointer" style={{ fontSize: 10, color: "#7b8a9a" }} onClick={(e) => e.stopPropagation()}>
                                    <input type="checkbox" checked={!!p.exclude_from_benchmarks}
                                      onChange={() => patch.mutate({ id: p.id, patch: { exclude_from_benchmarks: !p.exclude_from_benchmarks } })} /> Exclude
                                  </label>
                                </div>
                              </td>
                              <td className="px-4 py-2"></td>
                              <td className="px-4 py-2 font-mono text-right text-xs" style={{ color: "#7b8a9a" }}>{mins.toFixed(0)}</td>
                              <td className="px-4 py-2 font-mono text-right text-xs" style={{ color: "#7b8a9a" }}>{logged.toFixed(1)}</td>
                              <td className="px-4 py-2 font-mono text-right text-xs" style={{ color: "#cbd5e1" }}>{actualHM.toFixed(2)}</td>
                              <td className="px-4 py-2 font-mono text-right text-xs" style={{ color: "#7b8a9a" }}>{estHM.toFixed(2)}</td>
                              <td className="px-4 py-2 font-mono text-right text-xs" style={{ color: pv === null ? "#475569" : pv > 0 ? "#f87171" : "#4ade80" }}>{pv === null ? "—" : `${pv >= 0 ? "+" : ""}${pv}%`}</td>
                            </tr>
                          );
                        })}
                      </>
                    );
                  })}
                  {/* total */}
                  <tr style={{ borderTop: "2px solid #28384a" }}>
                    <td className="px-4 py-3 font-medium" style={{ color: "#e2e8f0" }}>All clients</td>
                    <td className="px-4 py-3 font-mono text-right" style={{ color: "#e2e8f0" }}>{total.count}</td>
                    <td className="px-4 py-3 font-mono text-right" style={{ color: "#9fb0c0" }}>{total.mins.toFixed(0)}</td>
                    <td className="px-4 py-3 font-mono text-right" style={{ color: "#9fb0c0" }}>{total.logged.toFixed(1)}</td>
                    <td className="px-4 py-3 font-mono text-right" style={{ color: "#e2e8f0" }}>{total.actualHM.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-right" style={{ color: "#9fb0c0" }}>{total.estHM.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-right" style={{ color: (variance(total.actualHM, total.estHM) ?? 0) > 0 ? "#f87171" : "#4ade80" }}>
                      {variance(total.actualHM, total.estHM) === null ? "—" : `${(variance(total.actualHM, total.estHM)! >= 0 ? "+" : "")}${variance(total.actualHM, total.estHM)}%`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <EstimateHelper eligible={eligible} clients={clients} />
        </>
      )}
    </div>
  );
}

function EstimateHelper({ eligible, clients }: {
  eligible: { p: Project; actualHM: number }[]; clients: { id: string; name: string; archived: boolean }[];
}) {
  const [client, setClient] = useState("All");
  const [minutes, setMinutes] = useState("");

  const pool = eligible.filter((e) => client === "All" || e.p.client_id === client).map((e) => e.actualHM).sort((a, b) => a - b);
  const mins = parseFloat(minutes) || 0;
  const median = pool.length ? percentile(pool, 0.5) : 0;
  const p25 = pool.length ? percentile(pool, 0.25) : 0;
  const p75 = pool.length ? percentile(pool, 0.75) : 0;

  return (
    <div className="rounded-xl border p-4" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
      <h2 className="font-display text-base mb-1" style={{ color: "#e2e8f0" }}>Estimate helper</h2>
      <p className="font-body text-sm mb-3" style={{ color: "#7b8a9a" }}>Suggested hours from past h/min. Read-only — nothing is saved.</p>
      <div className="flex flex-wrap items-end gap-3">
        <div><Label>Client</Label>
          <select className={fieldCls} style={{ ...fieldStyle, minWidth: 160 }} value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="All">All clients</option>
            {clients.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><Label>Video minutes</Label>
          <input type="number" min="0" step="0.5" className={fieldCls} style={{ ...fieldStyle, width: 120 }} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="e.g. 3" />
        </div>
      </div>
      {mins > 0 && pool.length > 0 ? (
        <div className="mt-4 rounded-lg p-4" style={{ background: "#11181f", border: "1px solid #1c2734" }}>
          <div className="font-mono text-2xl" style={{ color: "#e2e8f0" }}>{(median * mins).toFixed(1)}h</div>
          <div className="font-body text-sm mt-1" style={{ color: "#7b8a9a" }}>
            suggested (median {median.toFixed(2)} h/min × {mins} min) · range {(p25 * mins).toFixed(1)}–{(p75 * mins).toFixed(1)}h ({pool.length} project{pool.length === 1 ? "" : "s"})
          </div>
        </div>
      ) : (
        <div className="mt-3 font-body text-sm" style={{ color: "#475569" }}>Enter minutes to see a suggestion{pool.length === 0 ? " (no benchmark projects for this client yet)" : ""}.</div>
      )}
    </div>
  );
}
