import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Archive, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { useClients, useProjects, useTimeLogs, useClientMutations } from "../data/hooks";
import { PrimaryButton, GhostButton, ProgressBar, Modal, Label, fieldCls, fieldStyle, Spinner } from "../components/ui";
import { CLIENT_PALETTE, fmtDM } from "../lib/constants";
import type { Client } from "../lib/types";

export function Clients() {
  const nav = useNavigate();
  const { data: clients = [], isLoading } = useClients();
  const { data: projects = [] } = useProjects();
  const { data: timeLogs = [] } = useTimeLogs();
  const { setArchived } = useClientMutations();
  const [modal, setModal] = useState<{ mode: "add" | "edit"; client: Client | null } | null>(null);
  const [allTime, setAllTime] = useState(true);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "active", dir: "desc" });

  const loggedOf = (pid: string) => timeLogs.filter((l) => l.project_id === pid).reduce((a, l) => a + l.hours, 0);
  const lastEntryOf = (pid: string) => {
    const ds = timeLogs.filter((l) => l.project_id === pid).map((l) => l.log_date).sort();
    return ds.length ? ds[ds.length - 1] : null;
  };

  const rows = useMemo(() => {
    return clients.filter((c) => !c.archived).map((c) => {
      const all = projects.filter((p) => p.client_id === c.id);
      const active = all.filter((p) => !p.archived && p.status !== "Closed");
      const scope = allTime ? all : active;
      const logged = scope.reduce((s, p) => s + loggedOf(p.id), 0);
      const estimate = scope.reduce((s, p) => s + p.estimated_hours, 0);
      const overrun = estimate > 0 ? ((logged - estimate) / estimate) * 100 : null;
      // simple per-project mean overrun% (tooltip)
      const withEst = scope.filter((p) => p.estimated_hours > 0);
      const simpleMean = withEst.length
        ? withEst.reduce((s, p) => s + ((loggedOf(p.id) - p.estimated_hours) / p.estimated_hours) * 100, 0) / withEst.length
        : null;
      const starts = all.map((p) => p.start_date).filter(Boolean).sort() as string[];
      const lastStart = starts.length ? starts[starts.length - 1] : null;
      const lastEntries = all.map((p) => lastEntryOf(p.id)).filter(Boolean).sort() as string[];
      const lastEntry = lastEntries.length ? lastEntries[lastEntries.length - 1] : null;
      return { c, count: all.length, active: active.length, logged, estimate, overrun, simpleMean, lastStart, lastEntry };
    }).sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.key) {
        case "name": return a.c.name.localeCompare(b.c.name) * dir;
        case "active": return (a.active - b.active) * dir;
        case "hours": return (a.logged - b.logged) * dir;
        case "overrun": return ((a.overrun ?? -Infinity) - (b.overrun ?? -Infinity)) * dir;
        case "last": return ((a.lastStart ?? "") < (b.lastStart ?? "") ? -1 : 1) * dir;
        default: return 0;
      }
    });
  }, [clients, projects, timeLogs, allTime, sort]);

  const toggleSort = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  if (isLoading) return <Spinner label="Loading clients…" />;

  const COLS: { key: string | null; label: string; align?: string }[] = [
    { key: "name", label: "Client" },
    { key: "active", label: "Active projects" },
    { key: "hours", label: "Hours vs estimate" },
    { key: "overrun", label: "Avg overrun" },
    { key: null, label: "Avg review turnaround" },
    { key: "last", label: "Last project" },
    { key: null, label: "" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: "#11181f", border: "1px solid #25323f" }}>
          {[{ v: true, l: "All time" }, { v: false, l: "Active projects" }].map((o) => (
            <button key={o.l} onClick={() => setAllTime(o.v)} className="rounded-md px-3 py-1.5 text-sm font-body"
              style={allTime === o.v ? { background: "#e8795a", color: "#1a0d08" } : { color: "#9fb0c0" }}>{o.l}</button>
          ))}
        </div>
        <PrimaryButton onClick={() => setModal({ mode: "add", client: null })}><Plus size={16} /> Add Client</PrimaryButton>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="text-left" style={{ color: "#7b8a9a" }}>
                {COLS.map((c) => (
                  <th key={c.label || "actions"} onClick={c.key ? () => toggleSort(c.key!) : undefined}
                    className={`px-4 py-3 font-medium text-xs uppercase tracking-wider whitespace-nowrap ${c.key ? "cursor-pointer select-none" : ""}`}
                    style={{ borderBottom: "1px solid #1c2734", color: c.key && sort.key === c.key ? "#e8795a" : undefined }}>
                    <span className="inline-flex items-center gap-1">{c.label}
                      {c.key && (sort.key === c.key ? (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} style={{ opacity: 0.4 }} />)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, count, active, logged, estimate, overrun, simpleMean, lastStart, lastEntry }) => (
                <tr key={c.id} onClick={() => nav(`/projects?client=${c.id}`)} className="cursor-pointer" style={{ borderBottom: "1px solid #141c25" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium" style={{ color: "#e2e8f0" }}>
                      <span className="rounded-full shrink-0" style={{ width: 9, height: 9, background: c.color ?? "#64748b" }} />
                      {c.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono" style={{ color: "#e2e8f0" }}>{count === 0 ? "—" : active}</td>
                  <td className="px-4 py-3" style={{ minWidth: 170 }}>
                    {count === 0 ? <span style={{ color: "#475569" }}>—</span> : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1"><ProgressBar current={logged} est={estimate} /></div>
                        <span className="font-mono text-xs whitespace-nowrap" style={{ color: overrun !== null && overrun > 0 ? "#f87171" : "#9fb0c0" }}>{logged.toFixed(1)} / {estimate}h</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono" title={simpleMean !== null ? `Per-project mean: ${simpleMean >= 0 ? "+" : ""}${Math.round(simpleMean)}%` : undefined}
                    style={{ color: overrun === null ? "#475569" : overrun > 0 ? "#f87171" : "#4ade80" }}>
                    {overrun === null ? "—" : `${overrun >= 0 ? "+" : ""}${Math.round(overrun)}%`}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "#475569" }} title="Fills in as status history accrues">—</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "#9fb0c0" }} title={lastEntry ? `Last time entry ${fmtDM(lastEntry)}` : undefined}>{lastStart ? fmtDM(lastStart) : "—"}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1 justify-end">
                      <button title="Edit" onClick={() => setModal({ mode: "edit", client: c })} className="rounded-md p-1.5" style={{ color: "#7b8a9a" }}><Pencil size={15} /></button>
                      <button title="Archive" onClick={() => setArchived.mutate({ id: c.id, archived: true })} className="rounded-md p-1.5" style={{ color: "#7b8a9a" }}><Archive size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center font-body" style={{ color: "#475569" }}>No clients yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <ClientModal mode={modal.mode} client={modal.client} onClose={() => setModal(null)} />}
    </div>
  );
}

function ClientModal({ mode, client, onClose }: { mode: "add" | "edit"; client: Client | null; onClose: () => void }) {
  const { create, update } = useClientMutations();
  const { data: projects = [] } = useProjects();
  const { data: timeLogs = [] } = useTimeLogs();
  const [form, setForm] = useState({ name: client?.name ?? "", notes: client?.notes ?? "", color: client?.color ?? CLIENT_PALETTE[0] });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    if (!form.name.trim()) return;
    if (mode === "add") create.mutate(form, { onSuccess: onClose });
    else update.mutate({ id: client!.id, patch: form }, { onSuccess: onClose });
  };

  // Per-client figures (edit view only)
  const clientProjects = client ? projects.filter((p) => p.client_id === client.id && !p.archived) : [];
  const overBudget = clientProjects.filter((p) => {
    if (p.estimated_hours <= 0) return false;
    const logged = timeLogs.filter((l) => l.project_id === p.id).reduce((a, l) => a + l.hours, 0);
    return logged > p.estimated_hours;
  }).length;

  return (
    <Modal title={mode === "add" ? "New Client" : "Edit Client"} onClose={onClose}>
      <div className="space-y-4">
        <div><Label>Client Name *</Label><input className={fieldCls} style={fieldStyle} value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
        {mode === "edit" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3" style={{ background: "#11181f", border: "1px solid #1c2734" }}>
              <div className="font-body text-xs" style={{ color: "#7b8a9a" }}>Number of projects</div>
              <div className="font-mono text-2xl mt-1" style={{ color: "#e2e8f0" }}>{clientProjects.length}</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: "#11181f", border: "1px solid #1c2734" }}>
              <div className="font-body text-xs" style={{ color: "#7b8a9a" }}>Projects over budget</div>
              <div className="font-mono text-2xl mt-1" style={{ color: overBudget > 0 ? "#f87171" : "#e2e8f0" }}>{overBudget}</div>
            </div>
          </div>
        )}
        <div><Label>Colour</Label>
          <div className="flex flex-wrap gap-2">
            {CLIENT_PALETTE.map((c) => {
              const on = form.color === c;
              return (
                <button key={c} onClick={() => set("color", c)} title={c} className="rounded-full"
                  style={{ width: 26, height: 26, background: c, boxShadow: on ? "0 0 0 2px #0f151d, 0 0 0 4px #e2e8f0" : "none" }} />
              );
            })}
          </div>
        </div>
        <div><Label>Notes</Label><textarea rows={2} className={fieldCls} style={{ ...fieldStyle, resize: "vertical" }} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={submit} className={form.name.trim() ? "" : "opacity-50 pointer-events-none"}>{mode === "add" ? "Create" : "Save"}</PrimaryButton>
      </div>
    </Modal>
  );
}
