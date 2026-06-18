import { useState } from "react";
import { Plus, ListChecks, ChevronLeft, ChevronRight, Check, Star, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useProfiles, useProjects, useProjectMutations, useTaskMutations, useTimeLogs, useTimeLogMutations, useClientDirectory } from "../data/hooks";
import { Avatar, ProgressBar, Modal, Label, fieldCls, fieldStyle, DateField, Spinner } from "../components/ui";
import { TaskBoard } from "../components/TaskBoard";
import { ProjectCollab } from "../components/ProjectCollab";
import { TASKS, STATUSES, STATUS_STYLES, SCHEDULE_ACTIVITIES, fmtKey, fmtDM, addDays, TODAY } from "../lib/constants";
import type { Project, TaskName, TimeLog } from "../lib/types";

function nextAssignedItem(project: Project, artistId: string) {
  for (const t of TASKS) {
    const task = project.tasks[t];
    if (!task) continue;
    if (task.assignees.includes(artistId) && !task.done) return { type: "task" as const, task: t, label: t };
    for (const s of task.subtasks) {
      if (s.assignee === artistId && !s.done) return { type: "sub" as const, task: t, sub: s, label: `${t}: ${s.title}` };
    }
  }
  return null;
}

export function ArtistHome() {
  const { profile } = useAuth();
  const artistId = profile!.id;
  const { data: projects = [], isLoading } = useProjects();
  const { data: clientDir = [] } = useClientDirectory();
  const { data: profiles = [] } = useProfiles();
  const { data: timeLogs = [] } = useTimeLogs();
  const { setDone, updateSubtask } = useTaskMutations();
  const { setStatus } = useProjectMutations();
  const { add: addLog, update: updateLog, remove: removeLog } = useTimeLogMutations();

  const [openProj, setOpenProj] = useState<string | null>(null);
  const [logModal, setLogModal] = useState<{ prefill: string | null } | null>(null);
  const [editLog, setEditLog] = useState<TimeLog | null>(null);

  const mine = projects.filter((p) => !p.archived); // RLS already scopes to assigned projects
  const clientName = (id: string | null) => clientDir.find((c) => c.id === id)?.name ?? "—";
  const projHours = (pid: string) => timeLogs.filter((l) => l.project_id === pid).reduce((a, l) => a + l.hours, 0);

  // My Week (navigable by week)
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = (() => { const day = (TODAY.getDay() + 6) % 7; return addDays(addDays(TODAY, -day), weekOffset * 7); })();
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayHours = (d: Date) => timeLogs.filter((l) => l.user_id === artistId && l.log_date === fmtKey(d)).reduce((a, l) => a + l.hours, 0);
  const maxDay = Math.max(8, ...week.map(dayHours));

  const markItemDone = (item: ReturnType<typeof nextAssignedItem>, project: Project) => {
    if (!item) return;
    if (item.type === "task") setDone.mutate({ taskId: project.tasks[item.task].id, done: true });
    else updateSubtask.mutate({ id: item.sub.id, patch: { done: true } });
  };

  if (isLoading) return <Spinner label="Loading your projects…" />;

  const openProject = openProj ? projects.find((p) => p.id === openProj) : null;
  if (openProject) {
    const hoursForTask = (t: TaskName) => timeLogs.filter((l) => l.project_id === openProject.id && l.task === t).reduce((a, l) => a + l.hours, 0);
    const myCount = TASKS.filter((t) => openProject.tasks[t].assignees.includes(artistId)).length;
    return (
      <div className="space-y-6 relative">
        <button onClick={() => setLogModal({ prefill: openProject.id })}
          className="fixed bottom-6 right-6 sm:bottom-auto sm:top-20 z-30 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold font-body active:scale-95 transition-transform"
          style={{ background: "#e8795a", color: "#1a0d08", boxShadow: "0 10px 30px rgba(232,121,90,0.35)" }}>
          <Plus size={18} /> Log Time
        </button>
        <button onClick={() => setOpenProj(null)} className="inline-flex items-center gap-1 text-sm font-body" style={{ color: "#7b8a9a" }}>
          <ChevronLeft size={16} /> Back to my projects
        </button>
        <div className="rounded-xl border p-5" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full" style={{ width: 12, height: 12, background: openProject.color ?? "#64748b" }} />
            <h1 className="font-display text-2xl" style={{ color: "#f1f5f9" }}>{openProject.name}</h1>
            <select value={openProject.status} onChange={(e) => setStatus.mutate({ id: openProject.id, status: e.target.value })}
              className="rounded-full px-3 py-1 text-xs font-medium font-body cursor-pointer"
              style={{ background: STATUS_STYLES[openProject.status].bg, color: STATUS_STYLES[openProject.status].fg, border: `1px solid ${STATUS_STYLES[openProject.status].dot}55`, appearance: "none", textAlignLast: "center" }}>
              {STATUSES.map((s) => <option key={s} value={s} style={{ background: "#0f151d", color: "#e2e8f0" }}>{s}</option>)}
            </select>
          </div>
          <p className="mt-1 text-sm font-body" style={{ color: "#9fb0c0" }}>
            {clientName(openProject.client_id)} · Start {fmtDM(openProject.start_date)}
            {openProject.client_review_date ? ` · Review ${fmtDM(openProject.client_review_date)}` : ""}
            {myCount > 0 ? ` · ${myCount} task${myCount > 1 ? "s" : ""} assigned to you` : ""}
          </p>
        </div>
        <TaskBoard project={openProject} role="artist" currentUserId={artistId} profiles={profiles} hoursForTask={hoursForTask} />
        <ProjectCollab projectId={openProject.id} currentUserId={artistId} isManager={false} />

        <div className="rounded-xl border overflow-hidden" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid #1c2734" }}>
            <h2 className="font-display text-base" style={{ color: "#e2e8f0" }}>My Time Log</h2>
            <button onClick={() => setLogModal({ prefill: openProject.id })} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-body" style={{ background: "#161f29", color: "#cbd5e1", border: "1px solid #25323f" }}><Plus size={14} /> Log time</button>
          </div>
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="text-left" style={{ color: "#7b8a9a" }}>
                {["Date", "Task", "Hours", "Notes", ""].map((h, i) => <th key={i} className="px-5 py-2.5 font-medium text-xs uppercase tracking-wider">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {timeLogs.filter((l) => l.project_id === openProject.id && l.user_id === artistId)
                .sort((a, b) => (a.log_date < b.log_date ? 1 : -1))
                .map((l) => (
                <tr key={l.id} style={{ borderTop: "1px solid #141c25" }}>
                  <td className="px-5 py-2.5 font-mono text-xs" style={{ color: "#9fb0c0" }}>{fmtDM(l.log_date)}</td>
                  <td className="px-5 py-2.5" style={{ color: "#9fb0c0" }}>{l.task}</td>
                  <td className="px-5 py-2.5 font-mono" style={{ color: "#e2e8f0" }}>{l.hours}</td>
                  <td className="px-5 py-2.5" style={{ color: "#64748b" }}>{l.notes || "—"}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button title="Edit" onClick={() => setEditLog(l)} className="rounded-md p-1.5" style={{ color: "#7b8a9a" }}><Pencil size={14} /></button>
                      <button title="Delete" onClick={() => { if (confirm("Delete this time entry?")) removeLog.mutate(l.id); }} className="rounded-md p-1.5" style={{ color: "#7b8a9a" }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {timeLogs.filter((l) => l.project_id === openProject.id && l.user_id === artistId).length === 0 &&
                <tr><td colSpan={5} className="px-5 py-8 text-center font-body" style={{ color: "#475569" }}>You haven't logged time on this project yet.</td></tr>}
            </tbody>
          </table>
        </div>

        {logModal && <LogTimeModal artistProjects={mine} artistId={artistId} prefill={logModal.prefill} onClose={() => setLogModal(null)}
          onSubmit={(f) => addLog.mutate({ project_id: f.project_id || null, activity: f.activity as TimeLog["activity"], user_id: artistId, task: (f.activity ? null : f.task) as TimeLog["task"], hours: f.hours, log_date: f.log_date, notes: f.notes || null }, { onSuccess: () => setLogModal(null) })} />}

        {editLog && <EditTimeModal log={editLog} project={openProject} artistId={artistId} onClose={() => setEditLog(null)}
          onSave={(patch) => updateLog.mutate({ id: editLog.id, patch }, { onSuccess: () => setEditLog(null) })} />}
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <button onClick={() => setLogModal({ prefill: null })}
        className="fixed bottom-6 right-6 sm:bottom-auto sm:top-20 z-30 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold font-body active:scale-95 transition-transform"
        style={{ background: "#e8795a", color: "#1a0d08", boxShadow: "0 10px 30px rgba(232,121,90,0.35)" }}>
        <Plus size={18} /> Log Time
      </button>

      <div className="rounded-xl border p-5" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wider font-body" style={{ color: "#7b8a9a" }}>My Week</span>
          <div className="flex items-center gap-2">
            <span className="font-body text-xs" style={{ color: "#9fb0c0" }}>
              {week[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })} – {week[6].toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </span>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="rounded-md px-2 py-1 text-xs font-body" style={{ background: "#161f29", color: "#9fb0c0", border: "1px solid #25323f" }}>Today</button>
            )}
            <button onClick={() => setWeekOffset((w) => w - 1)} title="Previous week" className="rounded-md p-1.5" style={{ background: "#161f29", color: "#cbd5e1", border: "1px solid #25323f" }}><ChevronLeft size={15} /></button>
            <button onClick={() => setWeekOffset((w) => w + 1)} title="Next week" className="rounded-md p-1.5" style={{ background: "#161f29", color: "#cbd5e1", border: "1px solid #25323f" }}><ChevronRight size={15} /></button>
          </div>
        </div>
        <div className="flex items-end gap-3" style={{ height: 120 }}>
          {week.map((d, i) => {
            const h = dayHours(d);
            const isToday = fmtKey(d) === fmtKey(TODAY);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="font-mono text-xs" style={{ color: h > 0 ? "#e2e8f0" : "#475569" }}>{h || ""}</span>
                <div className="w-full rounded-md transition-all" style={{ height: `${Math.max((h / maxDay) * 70, h > 0 ? 6 : 2)}px`, background: h <= 0 ? "#1e2733" : h < 8 ? "#4ade80" : "#e8795a" }} />
                <span className="text-xs font-body" style={{ color: isToday ? "#e8795a" : "#64748b" }}>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}</span>
                <span className="font-mono" style={{ fontSize: 10, color: isToday ? "#e8795a" : "#475569" }}>{d.getDate()}/{d.getMonth() + 1}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg mb-3" style={{ color: "#f1f5f9" }}>My Projects <span className="font-body text-sm" style={{ color: "#64748b" }}>({mine.length})</span></h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {mine.map((p) => {
            const ph = projHours(p.id);
            const next = nextAssignedItem(p, artistId);
            return (
              <div key={p.id} className="rounded-xl border p-4 flex flex-col gap-3" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <button onClick={() => setOpenProj(p.id)} className="flex items-center gap-2 text-left">
                      <span className="rounded-full" style={{ width: 8, height: 8, background: p.color ?? "#64748b" }} />
                      <span className="font-display hover:underline" style={{ color: "#f1f5f9" }}>{p.name}</span>
                      {p.priority && (
                        <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-body shrink-0" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.04em", background: "rgba(232,121,90,0.16)", color: "#f1c2b1", border: "1px solid #e8795a" }}>
                          <Star size={9} fill="#e8795a" style={{ color: "#e8795a" }} /> Priority
                        </span>
                      )}
                    </button>
                    <div className="text-xs font-body mt-0.5" style={{ color: "#7b8a9a" }}>{clientName(p.client_id)} · Start {fmtDM(p.start_date)}</div>
                  </div>
                  <select value={p.status} onChange={(e) => setStatus.mutate({ id: p.id, status: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-full px-2.5 py-1 text-xs font-medium font-body cursor-pointer shrink-0"
                    style={{ background: STATUS_STYLES[p.status].bg, color: STATUS_STYLES[p.status].fg, border: `1px solid ${STATUS_STYLES[p.status].dot}55`, appearance: "none", textAlignLast: "center" }}>
                    {STATUSES.map((s) => <option key={s} value={s} style={{ background: "#0f151d", color: "#e2e8f0" }}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-body mb-1">
                    <span style={{ color: "#9fb0c0" }}>Hours</span>
                    <span className="font-mono" style={{ color: ph > p.estimated_hours ? "#f87171" : "#e2e8f0" }}>{ph.toFixed(1)}h <span style={{ color: "#475569" }}>/ {p.estimated_hours}h est.</span></span>
                  </div>
                  <ProgressBar current={ph} est={p.estimated_hours} />
                </div>
                {next ? (
                  <div className="rounded-lg p-2.5 flex items-center gap-2.5" style={{ background: "#11181f", border: "1px solid #25323f" }}>
                    <div className="min-w-0 flex-1">
                      <div className="uppercase tracking-wider font-body" style={{ fontSize: 10, color: "#64748b" }}>{next.type === "sub" ? "Next sub-task" : "Next task"}</div>
                      <div className="text-sm font-body truncate" style={{ color: "#e2e8f0" }}>{next.label}</div>
                    </div>
                    <button onClick={() => markItemDone(next, p)} title="Mark done & show next"
                      className="shrink-0 inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold font-body active:scale-95 transition-transform"
                      style={{ background: "rgba(74,222,128,0.14)", color: "#86efac", border: "1px solid #2f7a4f" }}>
                      <Check size={13} /> Close
                    </button>
                  </div>
                ) : (
                  <div className="rounded-lg p-2.5 text-xs font-body" style={{ background: "#11181f", border: "1px solid #25323f", color: "#64748b" }}>No open tasks assigned to you.</div>
                )}
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button onClick={() => setOpenProj(p.id)} className="inline-flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium font-body"
                    style={{ background: "#11181f", color: "#9fb0c0", border: "1px solid #25323f" }}><ListChecks size={15} /> Tasks</button>
                  <button onClick={() => setLogModal({ prefill: p.id })} className="inline-flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium font-body"
                    style={{ background: "#161f29", color: "#e8c2b4", border: "1px solid #2c3a47" }}><Plus size={15} /> Log Time</button>
                </div>
              </div>
            );
          })}
          {mine.length === 0 && <div className="font-body" style={{ color: "#475569" }}>You aren't assigned to any active projects.</div>}
        </div>
      </div>

      {logModal && <LogTimeModal artistProjects={mine} artistId={artistId} prefill={logModal.prefill} onClose={() => setLogModal(null)}
        onSubmit={(f) => addLog.mutate({ project_id: f.project_id || null, activity: f.activity as TimeLog["activity"], user_id: artistId, task: (f.activity ? null : f.task) as TimeLog["task"], hours: f.hours, log_date: f.log_date, notes: f.notes || null }, { onSuccess: () => setLogModal(null) })} />}
    </div>
  );
}

function LogTimeModal({ artistProjects, artistId, prefill, onClose, onSubmit }: {
  artistProjects: Project[]; artistId: string; prefill: string | null; onClose: () => void;
  onSubmit: (f: { project_id: string; activity: string | null; task: TaskName; log_date: string; hours: number; notes: string }) => void;
}) {
  // Tasks the artist is assigned to on a project (directly, or via an assigned sub-task).
  // Falls back to all tasks if they have none, so logging is never blocked.
  const tasksFor = (pid: string): TaskName[] => {
    const p = artistProjects.find((x) => x.id === pid);
    if (!p) return TASKS;
    const assigned = TASKS.filter((t) =>
      p.tasks[t]?.assignees.includes(artistId) || p.tasks[t]?.subtasks.some((s) => s.assignee === artistId));
    return assigned.length ? assigned : TASKS;
  };
  const initialProject = prefill ?? artistProjects[0]?.id ?? "";
  const [form, setForm] = useState({
    project_id: initialProject,
    activity: null as string | null,
    task: tasksFor(initialProject)[0] ?? TASKS[0],
    log_date: fmtKey(TODAY),
    hours: 1,
    notes: "",
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  // Dropdown holds projects + activities; activities are prefixed so we can tell them apart.
  const ACT = "activity:";
  const selValue = form.activity ? ACT + form.activity : form.project_id;
  const onSelChange = (val: string) => {
    if (val.startsWith(ACT)) setForm((f) => ({ ...f, activity: val.slice(ACT.length), project_id: "" }));
    else setForm((f) => ({ ...f, activity: null, project_id: val, task: tasksFor(val)[0] ?? TASKS[0] }));
  };
  const isActivity = !!form.activity;
  const taskOptions = tasksFor(form.project_id);
  const PRESETS = [1, 2, 4, 8];
  const ok = (form.project_id || form.activity) && form.hours > 0 && form.hours <= 24;
  return (
    <Modal title="Log Time" onClose={onClose}>
      <div className="space-y-4">
        <div><Label>Project or activity</Label>
          <select className={fieldCls} style={fieldStyle} value={selValue} onChange={(e) => onSelChange(e.target.value)}>
            <optgroup label="Projects">
              {artistProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </optgroup>
            <optgroup label="Activities">
              {SCHEDULE_ACTIVITIES.map((a) => <option key={a.name} value={ACT + a.name}>{a.name}</option>)}
            </optgroup>
          </select></div>
        {!isActivity && (
          <div><Label>Task</Label>
            <select className={fieldCls} style={fieldStyle} value={form.task} onChange={(e) => set("task", e.target.value)}>
              {taskOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select></div>
        )}
        <div><Label>Date</Label>
          <DateField value={form.log_date} onChange={(v) => set("log_date", v)} /></div>
        <div><Label>Hours (0.5 steps, max 24)</Label>
          <div className="flex items-center gap-2">
            <input type="number" step="0.5" min="0.5" max="24" className={fieldCls} style={{ ...fieldStyle, maxWidth: 110 }} value={form.hours} onChange={(e) => set("hours", +e.target.value)} />
            <div className="flex gap-1.5">
              {PRESETS.map((h) => {
                const on = form.hours === h;
                return (
                  <button key={h} onClick={() => set("hours", h)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold font-body active:scale-95 transition-transform"
                    style={{ background: on ? "#e8795a" : "#161f29", color: on ? "#1a0d08" : "#cbd5e1", border: `1px solid ${on ? "#e8795a" : "#25323f"}` }}>
                    {h}h
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div><Label>Notes (optional)</Label>
          <textarea rows={3} className={fieldCls} style={{ ...fieldStyle, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="What did you work on?" /></div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium font-body" style={{ background: "#161f29", color: "#cbd5e1", border: "1px solid #25323f" }}>Cancel</button>
        <button onClick={() => ok && onSubmit(form)} className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold font-body ${ok ? "" : "opacity-50 pointer-events-none"}`} style={{ background: "#e8795a", color: "#1a0d08" }}>Submit</button>
      </div>
    </Modal>
  );
}

// Edit one of the artist's own project time entries (task / date / hours / notes).
// No user reassignment — artists only edit their own logged time.
function EditTimeModal({ log, project, artistId, onClose, onSave }: {
  log: TimeLog; project: Project; artistId: string; onClose: () => void;
  onSave: (patch: { task: TaskName; log_date: string; hours: number; notes: string | null }) => void;
}) {
  const assigned = TASKS.filter((t) =>
    project.tasks[t]?.assignees.includes(artistId) || project.tasks[t]?.subtasks.some((s) => s.assignee === artistId));
  const taskOptions = assigned.length ? assigned : TASKS;
  const [form, setForm] = useState({
    task: (log.task ?? taskOptions[0]) as TaskName,
    log_date: log.log_date,
    hours: log.hours,
    notes: log.notes ?? "",
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const ok = form.hours > 0 && form.hours <= 24;
  return (
    <Modal title="Edit Time Entry" onClose={onClose}>
      <div className="space-y-4">
        <div><Label>Task</Label>
          <select className={fieldCls} style={fieldStyle} value={form.task} onChange={(e) => set("task", e.target.value)}>
            {taskOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Date</Label><DateField value={form.log_date} onChange={(v) => set("log_date", v)} /></div>
          <div><Label>Hours (max 24)</Label><input type="number" step="0.5" min="0.5" max="24" className={fieldCls} style={fieldStyle} value={form.hours} onChange={(e) => set("hours", +e.target.value)} /></div>
        </div>
        <div><Label>Notes (optional)</Label><textarea rows={2} className={fieldCls} style={{ ...fieldStyle, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium font-body" style={{ background: "#161f29", color: "#cbd5e1", border: "1px solid #25323f" }}>Cancel</button>
        <button onClick={() => ok && onSave({ task: form.task, log_date: form.log_date, hours: form.hours, notes: form.notes || null })} className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold font-body ${ok ? "" : "opacity-50 pointer-events-none"}`} style={{ background: "#e8795a", color: "#1a0d08" }}>Save</button>
      </div>
    </Modal>
  );
}
