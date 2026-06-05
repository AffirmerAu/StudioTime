import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Check, UserPlus, Download, ArrowUpDown, Palette, Plus, Pencil, Trash2 } from "lucide-react";
import { useClients, useProfiles, useProjects, useProjectMutations, useTimeLogs, useTimeLogMutations } from "../data/hooks";
import { Avatar, ProgressBar, GhostButton, PrimaryButton, Modal, Label, fieldCls, fieldStyle, DateField, Spinner } from "../components/ui";
import { TaskBoard } from "../components/TaskBoard";
import { TASKS, STATUSES, STATUS_STYLES, PROJECT_PALETTE, fmtKey, fmtDMY, healthColor, TODAY } from "../lib/constants";
import type { TaskName, TimeLog } from "../lib/types";

export function ProjectDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: projects = [], isLoading } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: profiles = [] } = useProfiles();
  const { data: timeLogs = [] } = useTimeLogs();
  const { toggleMember, patch } = useProjectMutations();
  const { remove: removeLog } = useTimeLogMutations();
  const [sortDesc, setSortDesc] = useState(true);
  const [showPalette, setShowPalette] = useState(false);
  const [logModal, setLogModal] = useState<{ mode: "add" | "edit"; log: TimeLog | null } | null>(null);

  if (isLoading) return <Spinner label="Loading project…" />;
  const project = projects.find((p) => p.id === id);
  if (!project) return <div className="font-body" style={{ color: "#64748b" }}>Project not found.</div>;

  const artists = profiles.filter((p) => p.role === "artist");
  const logs = timeLogs.filter((l) => l.project_id === project.id);
  const cur = logs.reduce((a, l) => a + l.hours, 0);
  const client = clients.find((c) => c.id === project.client_id);
  const nameOf = (uid: string) => profiles.find((p) => p.id === uid)?.full_name ?? "Unknown";
  const hoursForTask = (t: TaskName) => logs.filter((l) => l.task === t).reduce((a, l) => a + l.hours, 0);
  const sortedLogs = [...logs].sort((a, b) => (sortDesc ? b.log_date.localeCompare(a.log_date) : a.log_date.localeCompare(b.log_date)));

  const exportCsv = () => {
    const rows = [["Date", "Artist", "Task", "Hours", "Notes"], ...sortedLogs.map((l) => [l.log_date, nameOf(l.user_id), l.task, String(l.hours), (l.notes ?? "").replace(/"/g, '""')])];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name.replace(/\s+/g, "_")}_timelog.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <button onClick={() => nav("/dashboard")} className="inline-flex items-center gap-1 text-sm font-body" style={{ color: "#7b8a9a" }}>
        <ChevronLeft size={16} /> Back to dashboard
      </button>

      <div className="rounded-xl border p-5" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <button onClick={() => setShowPalette((v) => !v)} title="Change project colour"
                  className="rounded-full flex items-center justify-center" style={{ width: 16, height: 16, background: project.color ?? "#64748b", boxShadow: "0 0 0 2px #0f151d, 0 0 0 3px #2a3744" }}>
                  <Palette size={9} style={{ color: "rgba(0,0,0,0.45)" }} />
                </button>
                {showPalette && (
                  <div className="absolute z-30 mt-2 flex flex-wrap gap-1.5 rounded-xl border p-2.5" style={{ width: 184, background: "#0f151d", borderColor: "#25323f", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}
                    onMouseLeave={() => setShowPalette(false)}>
                    {PROJECT_PALETTE.map((c) => {
                      const on = project.color === c;
                      return (
                        <button key={c} onClick={() => { patch.mutate({ id: project.id, patch: { color: c } }); setShowPalette(false); }} title={c}
                          className="rounded-full" style={{ width: 24, height: 24, background: c, boxShadow: on ? "0 0 0 2px #0f151d, 0 0 0 4px #e2e8f0" : "none" }} />
                      );
                    })}
                  </div>
                )}
              </div>
              <h1 className="font-display text-2xl" style={{ color: "#f1f5f9" }}>{project.name}</h1>
              <select value={project.status} onChange={(e) => patch.mutate({ id: project.id, patch: { status: e.target.value } })}
                className="rounded-full px-3 py-1 text-xs font-medium font-body cursor-pointer"
                style={{ background: STATUS_STYLES[project.status].bg, color: STATUS_STYLES[project.status].fg, border: `1px solid ${STATUS_STYLES[project.status].dot}55`, appearance: "none", textAlignLast: "center" }}>
                {STATUSES.map((s) => <option key={s} value={s} style={{ background: "#0f151d", color: "#e2e8f0" }}>{s}</option>)}
              </select>
            </div>
            <p className="mt-1 text-sm font-body" style={{ color: "#9fb0c0" }}>
              {client?.name} · Start {fmtDMY(project.start_date)} · Review {fmtDMY(project.client_review_date)}
              {project.closed_date ? ` · Closed ${fmtDMY(project.closed_date)}` : ""}
              {project.video_minutes ? ` · ${project.video_minutes} video min` : ""}
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-2xl" style={{ color: healthColor(cur, project.estimated_hours) }}>{cur.toFixed(1)}<span style={{ color: "#475569" }}> / {project.estimated_hours}h</span></div>
            <div className="w-48 mt-1"><ProgressBar current={cur} est={project.estimated_hours} height={8} /></div>
          </div>
        </div>

        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider mb-2 font-body" style={{ color: "#7b8a9a" }}>Assigned Artists — click to toggle</div>
          <div className="flex flex-wrap gap-2">
            {artists.map((a) => {
              const on = project.users.includes(a.id);
              return (
                <button key={a.id} onClick={() => toggleMember.mutate({ projectId: project.id, userId: a.id, on: !on })}
                  className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-sm font-body"
                  style={{ background: on ? "rgba(232,121,90,0.16)" : "#0a0f15", border: `1px solid ${on ? "#e8795a" : "#25323f"}`, color: on ? "#f1c2b1" : "#64748b" }}>
                  <Avatar id={a.id} name={a.full_name ?? ""} size={22} />{(a.full_name ?? "").split(" ")[0]}{on ? <Check size={14} /> : <UserPlus size={13} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <TaskBoard project={project} role="manager" currentUserId={profiles.find((p) => p.role === "manager")?.id ?? ""} profiles={profiles} hoursForTask={hoursForTask} />

      <div className="rounded-xl border overflow-hidden" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid #1c2734" }}>
          <h2 className="font-display text-base" style={{ color: "#e2e8f0" }}>Time Log <span className="font-body text-sm" style={{ color: "#64748b" }}>({logs.length})</span></h2>
          <div className="flex items-center gap-2">
            <GhostButton onClick={exportCsv}><Download size={15} /> Export CSV</GhostButton>
            <PrimaryButton onClick={() => setLogModal({ mode: "add", log: null })}><Plus size={15} /> Add time</PrimaryButton>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="text-left" style={{ color: "#7b8a9a" }}>
                <th className="px-5 py-2.5 font-medium text-xs uppercase tracking-wider cursor-pointer select-none" onClick={() => setSortDesc((s) => !s)}>
                  <span className="inline-flex items-center gap-1">Date <ArrowUpDown size={12} /></span>
                </th>
                {["Artist", "Task", "Hours", "Notes"].map((h) => <th key={h} className="px-5 py-2.5 font-medium text-xs uppercase tracking-wider">{h}</th>)}
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {sortedLogs.map((l) => (
                <tr key={l.id} style={{ borderTop: "1px solid #141c25" }}>
                  <td className="px-5 py-2.5 font-mono text-xs" style={{ color: "#9fb0c0" }}>{fmtDMY(l.log_date)}</td>
                  <td className="px-5 py-2.5"><span className="inline-flex items-center gap-2" style={{ color: "#e2e8f0" }}><Avatar id={l.user_id} name={nameOf(l.user_id)} size={20} /> {nameOf(l.user_id)}</span></td>
                  <td className="px-5 py-2.5" style={{ color: "#9fb0c0" }}>{l.task}</td>
                  <td className="px-5 py-2.5 font-mono" style={{ color: "#e2e8f0" }}>{l.hours}</td>
                  <td className="px-5 py-2.5" style={{ color: "#64748b" }}>{l.notes || "—"}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button title="Edit" onClick={() => setLogModal({ mode: "edit", log: l })} className="rounded-md p-1.5" style={{ color: "#7b8a9a" }}><Pencil size={14} /></button>
                      <button title="Delete" onClick={() => { if (confirm("Delete this time log?")) removeLog.mutate(l.id); }} className="rounded-md p-1.5" style={{ color: "#7b8a9a" }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedLogs.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center font-body" style={{ color: "#475569" }}>No time logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {logModal && (
        <TimeLogModal mode={logModal.mode} log={logModal.log} projectId={project.id}
          artists={artists} onClose={() => setLogModal(null)} />
      )}
    </div>
  );
}

function TimeLogModal({ mode, log, projectId, artists, onClose }: {
  mode: "add" | "edit"; log: TimeLog | null; projectId: string;
  artists: { id: string; full_name: string | null }[]; onClose: () => void;
}) {
  const { add, update } = useTimeLogMutations();
  const [form, setForm] = useState({
    user_id: log?.user_id ?? artists[0]?.id ?? "",
    task: (log?.task ?? TASKS[0]) as TaskName,
    log_date: log?.log_date ?? fmtKey(TODAY),
    hours: log?.hours ?? 1,
    notes: log?.notes ?? "",
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const ok = form.user_id && form.hours > 0 && form.hours <= 24;
  const submit = () => {
    if (!ok) return;
    if (mode === "add") {
      add.mutate({ project_id: projectId, user_id: form.user_id, task: form.task, hours: form.hours, log_date: form.log_date, notes: form.notes || null }, { onSuccess: onClose });
    } else {
      update.mutate({ id: log!.id, patch: { user_id: form.user_id, task: form.task, hours: form.hours, log_date: form.log_date, notes: form.notes || null } }, { onSuccess: onClose });
    }
  };
  return (
    <Modal title={mode === "add" ? "Add Time" : "Edit Time Log"} onClose={onClose}>
      <div className="space-y-4">
        <div><Label>Artist</Label>
          <select className={fieldCls} style={fieldStyle} value={form.user_id} onChange={(e) => set("user_id", e.target.value)}>
            {artists.map((a) => <option key={a.id} value={a.id}>{a.full_name ?? "Unnamed"}</option>)}
          </select></div>
        <div><Label>Task</Label>
          <select className={fieldCls} style={fieldStyle} value={form.task} onChange={(e) => set("task", e.target.value)}>
            {TASKS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Date</Label>
            <DateField value={form.log_date} onChange={(v) => set("log_date", v)} /></div>
          <div><Label>Hours (max 24)</Label>
            <input type="number" step="0.5" min="0.5" max="24" className={fieldCls} style={fieldStyle} value={form.hours} onChange={(e) => set("hours", +e.target.value)} /></div>
        </div>
        <div><Label>Notes (optional)</Label>
          <textarea rows={2} className={fieldCls} style={{ ...fieldStyle, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={submit} className={ok ? "" : "opacity-50 pointer-events-none"}>{mode === "add" ? "Add" : "Save"}</PrimaryButton>
      </div>
    </Modal>
  );
}
