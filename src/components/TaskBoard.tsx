import { useState } from "react";
import { Plus, X, Check } from "lucide-react";
import { TASKS } from "../lib/constants";
import type { Profile, Project, Role, TaskName } from "../lib/types";
import { Avatar, TaskCheckbox, fieldCls, fieldStyle } from "./ui";
import { useTaskMutations } from "../data/hooks";

export function TaskBoard({
  project, role, currentUserId, profiles, hoursForTask,
}: {
  project: Project;
  role: Role;
  currentUserId: string;
  profiles: Profile[];
  hoursForTask: (task: TaskName) => number;
}) {
  const [draft, setDraft] = useState<Record<string, { title: string; assignee: string }>>({});
  const [openAdd, setOpenAdd] = useState<Record<string, boolean>>({});
  const { setDone, toggleAssignee, addSubtask, updateSubtask, removeSubtask } = useTaskMutations();

  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.full_name ?? "Unknown";
  const artists = profiles.filter((p) => p.role === "artist");
  const pool = artists.filter((a) => project.users.includes(a.id)); // task-level (members)
  const subPool = artists; // sub-tasks → anyone

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
      <div className="px-5 py-3" style={{ borderBottom: "1px solid #1c2734" }}>
        <h2 className="font-display text-base" style={{ color: "#e2e8f0" }}>Tasks</h2>
      </div>
      <div className="divide-y" style={{ borderColor: "#141c25" }}>
        {TASKS.map((taskName) => {
          const t = project.tasks[taskName];
          const subs = t.subtasks ?? [];
          const subDone = subs.filter((s) => s.done).length;
          const addOpen = openAdd[taskName];
          return (
            <div key={taskName} className="px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <TaskCheckbox done={t.done} onClick={() => setDone.mutate({ taskId: t.id, done: !t.done })} color={project.color ?? "#e8795a"} />
                  <span className="font-body" style={{ color: t.done ? "#64748b" : "#e2e8f0", textDecoration: t.done ? "line-through" : "none" }}>{taskName}</span>
                  {subs.length > 0 && <span className="text-xs font-mono" style={{ color: "#64748b" }}>{subDone}/{subs.length}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {role === "manager" ? (
                      pool.length === 0 ? <span className="text-xs font-body" style={{ color: "#475569" }}>assign artists first</span> :
                      pool.map((a) => {
                        const on = t.assignees.includes(a.id);
                        return (
                          <button key={a.id} title={a.full_name ?? ""} onClick={() => toggleAssignee.mutate({ taskId: t.id, userId: a.id, on: !on })}
                            className="rounded-full" style={{ opacity: on ? 1 : 0.3, boxShadow: on ? `0 0 0 1.5px ${project.color}` : "none" }}>
                            <Avatar id={a.id} name={a.full_name ?? ""} size={22} />
                          </button>
                        );
                      })
                    ) : (
                      t.assignees.length > 0
                        ? t.assignees.map((uid) => <Avatar key={uid} id={uid} name={nameOf(uid)} size={22} />)
                        : <span className="text-xs font-body" style={{ color: "#475569" }}>unassigned</span>
                    )}
                  </div>
                  <span className="font-mono text-sm w-14 text-right" style={{ color: "#9fb0c0" }}>{hoursForTask(taskName)}h</span>
                </div>
              </div>

              {(subs.length > 0 || addOpen) && (
                <div className="mt-2.5 ml-7 space-y-1.5">
                  {subs.map((s) => (
                    <div key={s.id} className="flex items-center gap-2.5">
                      <TaskCheckbox done={s.done} onClick={() => updateSubtask.mutate({ id: s.id, patch: { done: !s.done } })} color="#5e9cea" />
                      <span className="text-sm font-body flex-1 min-w-0 truncate" style={{ color: s.done ? "#64748b" : "#cbd5e1", textDecoration: s.done ? "line-through" : "none" }}>{s.title}</span>
                      <select value={s.assignee ?? ""} onChange={(e) => updateSubtask.mutate({ id: s.id, patch: { assignee: e.target.value || null } })}
                        className="rounded-md px-1.5 py-0.5 text-xs font-body" style={{ background: "#0a0f15", border: "1px solid #25323f", color: s.assignee ? "#cbd5e1" : "#64748b" }}>
                        <option value="">Unassigned</option>
                        {subPool.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                      </select>
                      <button onClick={() => removeSubtask.mutate(s.id)} className="rounded p-1" style={{ color: "#475569" }}><X size={13} /></button>
                    </div>
                  ))}
                  {addOpen && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <input autoFocus placeholder="New sub-task…" value={draft[taskName]?.title ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, [taskName]: { ...d[taskName], title: e.target.value, assignee: d[taskName]?.assignee ?? "" } }))}
                        onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); }}
                        className="flex-1 rounded-md px-2 py-1 text-sm font-body" style={{ background: "#0a0f15", border: "1px solid #25323f", color: "#e2e8f0" }} />
                      <select value={draft[taskName]?.assignee ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [taskName]: { ...d[taskName], assignee: e.target.value, title: d[taskName]?.title ?? "" } }))}
                        className="rounded-md px-1.5 py-1 text-xs font-body" style={{ background: "#0a0f15", border: "1px solid #25323f", color: "#cbd5e1" }}>
                        <option value="">Assign…</option>
                        {subPool.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                      </select>
                      <button onClick={submitAdd} className="rounded-md px-2 py-1 text-xs font-semibold font-body" style={{ background: "#e8795a", color: "#1a0d08" }}>Add</button>
                    </div>
                  )}
                </div>
              )}

              <button onClick={() => setOpenAdd((o) => ({ ...o, [taskName]: !o[taskName] }))}
                className="mt-2 ml-7 inline-flex items-center gap-1 text-xs font-body" style={{ color: "#64748b" }}>
                <Plus size={12} /> {addOpen ? "Close" : "Add sub-task"}
              </button>
            </div>
          );

          function submitAdd() {
            const d = draft[taskName];
            if (!d || !d.title.trim()) return;
            addSubtask.mutate({ taskId: t.id, title: d.title.trim(), assignee: d.assignee || null, createdBy: currentUserId });
            setDraft((dd) => ({ ...dd, [taskName]: { title: "", assignee: d.assignee } }));
          }
        })}
      </div>
    </div>
  );
}
