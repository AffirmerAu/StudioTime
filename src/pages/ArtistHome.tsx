import { useState } from "react";
import { Plus, ListChecks, ChevronLeft, Check } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useClients, useProfiles, useProjects, useTaskMutations, useTimeLogs, useTimeLogMutations } from "../data/hooks";
import { Avatar, ProgressBar, StatusBadge, Modal, Label, fieldCls, fieldStyle, Spinner } from "../components/ui";
import { TaskBoard } from "../components/TaskBoard";
import { TASKS, fmtKey, fmtDMY, addDays, TODAY } from "../lib/constants";
import type { Project, TaskName } from "../lib/types";

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
  const { data: clients = [] } = useClients();
  const { data: profiles = [] } = useProfiles();
  const { data: timeLogs = [] } = useTimeLogs();
  const { setDone, updateSubtask } = useTaskMutations();
  const { add: addLog } = useTimeLogMutations();

  const [openProj, setOpenProj] = useState<string | null>(null);
  const [logModal, setLogModal] = useState<{ prefill: string | null } | null>(null);

  const mine = projects.filter((p) => !p.archived); // RLS already scopes to assigned projects
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";
  const myHours = (pid: string) => timeLogs.filter((l) => l.project_id === pid && l.user_id === artistId).reduce((a, l) => a + l.hours, 0);
  const projHours = (pid: string) => timeLogs.filter((l) => l.project_id === pid).reduce((a, l) => a + l.hours, 0);

  // My Week
  const weekStart = (() => { const day = (TODAY.getDay() + 6) % 7; return addDays(TODAY, -day); })();
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
          <div className="flex items-center gap-3">
            <span className="rounded-full" style={{ width: 12, height: 12, background: openProject.color ?? "#64748b" }} />
            <h1 className="font-display text-2xl" style={{ color: "#f1f5f9" }}>{openProject.name}</h1>
            <StatusBadge status={openProject.status} />
          </div>
          <p className="mt-1 text-sm font-body" style={{ color: "#9fb0c0" }}>
            {clientName(openProject.client_id)} · Start {fmtDMY(openProject.start_date)}
            {openProject.client_review_date ? ` · Review ${fmtDMY(openProject.client_review_date)}` : ""}
            {myCount > 0 ? ` · ${myCount} task${myCount > 1 ? "s" : ""} assigned to you` : ""}
          </p>
        </div>
        <TaskBoard project={openProject} role="artist" currentUserId={artistId} profiles={profiles} hoursForTask={hoursForTask} />
        {logModal && <LogTimeModal artistProjects={mine} prefill={logModal.prefill} onClose={() => setLogModal(null)}
          onSubmit={(f) => addLog.mutate({ project_id: f.project_id, user_id: artistId, task: f.task, hours: f.hours, log_date: f.log_date, notes: f.notes || null }, { onSuccess: () => setLogModal(null) })} />}
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
        <div className="text-xs uppercase tracking-wider mb-3 font-body" style={{ color: "#7b8a9a" }}>My Week</div>
        <div className="flex items-end gap-3" style={{ height: 110 }}>
          {week.map((d, i) => {
            const h = dayHours(d);
            const isToday = fmtKey(d) === fmtKey(TODAY);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="font-mono text-xs" style={{ color: h > 0 ? "#e2e8f0" : "#475569" }}>{h || ""}</span>
                <div className="w-full rounded-md transition-all" style={{ height: `${Math.max((h / maxDay) * 78, h > 0 ? 6 : 2)}px`, background: h > 0 ? "#e8795a" : "#1e2733" }} />
                <span className="text-xs font-body" style={{ color: isToday ? "#e8795a" : "#64748b" }}>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg mb-3" style={{ color: "#f1f5f9" }}>My Projects <span className="font-body text-sm" style={{ color: "#64748b" }}>({mine.length})</span></h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {mine.map((p) => {
            const mh = myHours(p.id), ph = projHours(p.id);
            const next = nextAssignedItem(p, artistId);
            return (
              <div key={p.id} className="rounded-xl border p-4 flex flex-col gap-3" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <button onClick={() => setOpenProj(p.id)} className="flex items-center gap-2 text-left">
                      <span className="rounded-full" style={{ width: 8, height: 8, background: p.color ?? "#64748b" }} />
                      <span className="font-display hover:underline" style={{ color: "#f1f5f9" }}>{p.name}</span>
                    </button>
                    <div className="text-xs font-body mt-0.5" style={{ color: "#7b8a9a" }}>{clientName(p.client_id)}</div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-body mb-1">
                    <span style={{ color: "#9fb0c0" }}>My hours</span>
                    <span className="font-mono" style={{ color: "#e2e8f0" }}>{mh.toFixed(1)}h <span style={{ color: "#475569" }}>/ {ph.toFixed(1)}h total</span></span>
                  </div>
                  <ProgressBar current={mh} est={ph || 1} />
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

      {logModal && <LogTimeModal artistProjects={mine} prefill={logModal.prefill} onClose={() => setLogModal(null)}
        onSubmit={(f) => addLog.mutate({ project_id: f.project_id, user_id: artistId, task: f.task, hours: f.hours, log_date: f.log_date, notes: f.notes || null }, { onSuccess: () => setLogModal(null) })} />}
    </div>
  );
}

function LogTimeModal({ artistProjects, prefill, onClose, onSubmit }: {
  artistProjects: Project[]; prefill: string | null; onClose: () => void;
  onSubmit: (f: { project_id: string; task: TaskName; log_date: string; hours: number; notes: string }) => void;
}) {
  const [form, setForm] = useState({
    project_id: prefill ?? artistProjects[0]?.id ?? "",
    task: TASKS[0] as TaskName,
    log_date: fmtKey(TODAY),
    hours: 1,
    notes: "",
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const ok = form.project_id && form.hours > 0 && form.hours <= 24;
  return (
    <Modal title="Log Time" onClose={onClose}>
      <div className="space-y-4">
        <div><Label>Project</Label>
          <select className={fieldCls} style={fieldStyle} value={form.project_id} onChange={(e) => set("project_id", e.target.value)}>
            {artistProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
        <div><Label>Task</Label>
          <select className={fieldCls} style={fieldStyle} value={form.task} onChange={(e) => set("task", e.target.value)}>
            {TASKS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Date</Label>
            <input type="date" className={fieldCls} style={fieldStyle} value={form.log_date} onChange={(e) => set("log_date", e.target.value)} /></div>
          <div><Label>Hours (0.5 steps, max 24)</Label>
            <input type="number" step="0.5" min="0.5" max="24" className={fieldCls} style={fieldStyle} value={form.hours} onChange={(e) => set("hours", +e.target.value)} /></div>
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
