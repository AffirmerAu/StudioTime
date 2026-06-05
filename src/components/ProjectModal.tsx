import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { useProfiles, useProjectMutations } from "../data/hooks";
import { Avatar, PrimaryButton, GhostButton, Modal, Label, fieldCls, fieldStyle, DateField } from "./ui";
import { STATUSES, TASKS, PROJECT_PALETTE, fmtKey, TODAY } from "../lib/constants";
import type { Client, Project, ProjectInput, ProjectStatus, TaskName } from "../lib/types";

export function ProjectModal({ mode, project, clients, onClose }: {
  mode: "add" | "edit"; project: Project | null; clients: Client[]; onClose: () => void;
}) {
  const { data: profiles = [] } = useProfiles();
  const artists = profiles.filter((p) => p.role === "artist");
  const { create, update } = useProjectMutations();

  const [form, setForm] = useState(() => {
    const ta: Record<string, string[]> = {};
    TASKS.forEach((t) => { ta[t] = project?.tasks[t]?.assignees ? [...project.tasks[t].assignees] : []; });
    return {
      name: project?.name ?? "",
      client_id: project?.client_id ?? clients[0]?.id ?? null,
      users: project?.users ?? [],
      taskAssignees: ta,
      estimated_hours: project ? String(project.estimated_hours) : "",
      status: (project?.status ?? "Upcoming") as ProjectStatus,
      start_date: project?.start_date ?? fmtKey(TODAY),
      client_review_date: project?.client_review_date ?? "",
      closed_date: project?.closed_date ?? "",
      video_minutes: project?.video_minutes != null ? String(project.video_minutes) : "",
      color: project?.color ?? PROJECT_PALETTE[Math.floor(Math.random() * PROJECT_PALETTE.length)],
    };
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const toggleUser = (uid: string) => setForm((f) => {
    const on = f.users.includes(uid);
    const users = on ? f.users.filter((u) => u !== uid) : [...f.users, uid];
    const ta = { ...f.taskAssignees };
    if (on) TASKS.forEach((t) => { ta[t] = (ta[t] ?? []).filter((u) => u !== uid); });
    return { ...f, users, taskAssignees: ta };
  });
  const toggleTaskUser = (task: string, uid: string) => setForm((f) => {
    const cur = f.taskAssignees[task] ?? [];
    return { ...f, taskAssignees: { ...f.taskAssignees, [task]: cur.includes(uid) ? cur.filter((u) => u !== uid) : [...cur, uid] } };
  });
  const assignAllTo = (uid: string) => setForm((f) => {
    const ta: Record<string, string[]> = {};
    TASKS.forEach((t) => { const cur = f.taskAssignees[t] ?? []; ta[t] = cur.includes(uid) ? cur : [...cur, uid]; });
    return { ...f, taskAssignees: ta };
  });
  const canSave = form.name.trim() && form.estimated_hours !== "";

  const submit = () => {
    if (!canSave) return;
    const input: ProjectInput = {
      name: form.name.trim(),
      client_id: form.client_id,
      status: form.status,
      estimated_hours: +form.estimated_hours || 0,
      start_date: form.start_date || null,
      client_review_date: form.client_review_date || null,
      closed_date: form.closed_date || null,
      video_minutes: form.video_minutes === "" ? null : +form.video_minutes,
      color: form.color,
      users: form.users,
      taskAssignees: form.taskAssignees as Record<TaskName, string[]>,
    };
    if (mode === "add") create.mutate(input, { onSuccess: onClose });
    else update.mutate({ id: project!.id, input }, { onSuccess: onClose });
  };

  return (
    <Modal title={mode === "add" ? "New Project" : "Edit Project"} onClose={onClose} wide>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><Label>Project Name *</Label>
          <input className={fieldCls} style={fieldStyle} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Spring Brand Film" /></div>
        <div><Label>Client</Label>
          <select className={fieldCls} style={fieldStyle} value={form.client_id ?? ""} onChange={(e) => set("client_id", e.target.value || null)}>
            {clients.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div><Label>Status</Label>
          <select className={fieldCls} style={fieldStyle} value={form.status} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select></div>
        <div><Label>Estimated Hours *</Label>
          <input type="number" className={fieldCls} style={fieldStyle} value={form.estimated_hours} onChange={(e) => set("estimated_hours", e.target.value)} /></div>
        <div><Label>Video Minutes</Label>
          <input type="number" step="0.25" className={fieldCls} style={fieldStyle} value={form.video_minutes} onChange={(e) => set("video_minutes", e.target.value)} /></div>
        <div><Label>Start Date</Label>
          <DateField value={form.start_date ?? ""} onChange={(v) => set("start_date", v)} clearable /></div>
        <div><Label>Client Review Date (added later)</Label>
          <DateField value={form.client_review_date ?? ""} onChange={(v) => set("client_review_date", v)} clearable placeholder="Not set" /></div>
        <div><Label>Closed Date (optional)</Label>
          <DateField value={form.closed_date ?? ""} onChange={(v) => set("closed_date", v)} clearable placeholder="Not set" /></div>

        <div className="sm:col-span-2"><Label>Project Colour</Label>
          <div className="flex flex-wrap gap-2">
            {PROJECT_PALETTE.map((c) => {
              const on = form.color === c;
              return (
                <button key={c} onClick={() => set("color", c)} title={c}
                  className="rounded-full" style={{ width: 26, height: 26, background: c, boxShadow: on ? "0 0 0 2px #0f151d, 0 0 0 4px #e2e8f0" : "none" }} />
              );
            })}
          </div>
        </div>

        <div className="sm:col-span-2"><Label>Assigned Artists</Label>
          <div className="flex flex-wrap gap-2">
            {artists.map((a) => {
              const on = form.users.includes(a.id);
              return (
                <button key={a.id} onClick={() => toggleUser(a.id)} className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-sm font-body"
                  style={{ background: on ? "rgba(232,121,90,0.16)" : "#0a0f15", border: `1px solid ${on ? "#e8795a" : "#25323f"}`, color: on ? "#f1c2b1" : "#9fb0c0" }}>
                  <Avatar id={a.id} name={a.full_name ?? ""} size={22} />{(a.full_name ?? "").split(" ")[0]}{on && <Check size={14} />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="sm:col-span-2"><Label>Task Assignments</Label>
          {form.users.length === 0 ? (
            <p className="text-xs font-body" style={{ color: "#475569" }}>Select assigned artists above first, then you can assign them to specific tasks.</p>
          ) : (
            <div className="rounded-lg border" style={{ borderColor: "#1c2734", background: "#0a0f15" }}>
              <div className="flex flex-wrap items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid #1c2734" }}>
                <span className="text-xs font-body" style={{ color: "#7b8a9a" }}>Assign every task to:</span>
                {form.users.map((uid) => {
                  const a = artists.find((x) => x.id === uid);
                  return a ? (
                    <button key={uid} onClick={() => assignAllTo(uid)} className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-0.5 text-xs font-body"
                      style={{ background: "#161f29", border: "1px solid #2c3a47", color: "#cbd5e1" }}>
                      <Avatar id={uid} name={a.full_name ?? ""} size={18} />{(a.full_name ?? "").split(" ")[0]}<Plus size={11} />
                    </button>
                  ) : null;
                })}
              </div>
              <div className="divide-y" style={{ borderColor: "#141c25" }}>
                {TASKS.map((t) => (
                  <div key={t} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="text-sm font-body" style={{ color: "#cbd5e1" }}>{t}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {form.users.map((uid) => {
                        const a = artists.find((x) => x.id === uid);
                        if (!a) return null;
                        const on = (form.taskAssignees[t] ?? []).includes(uid);
                        return (
                          <button key={uid} onClick={() => toggleTaskUser(t, uid)} title={a.full_name ?? ""} className="rounded-full"
                            style={{ opacity: on ? 1 : 0.3, boxShadow: on ? "0 0 0 1.5px #e8795a" : "none" }}>
                            <Avatar id={uid} name={a.full_name ?? ""} size={22} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={submit} className={canSave ? "" : "opacity-50 pointer-events-none"}>
          {mode === "add" ? "Create Project" : "Save Changes"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
