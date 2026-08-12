import { useState } from "react";
import { Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import { useProfiles, useProjects, useSchedule, useScheduleMutations, useProjectDirectory } from "../data/hooks";
import { Avatar, Modal, Label, fieldCls, fieldStyle, DateField, Spinner } from "./ui";
import { SCHEDULE_ACTIVITIES, fmtDM, fmtKey, TODAY } from "../lib/constants";
import type { ScheduleEntry } from "../lib/types";

const ACT = "activity:";

export function SchedulerMobile({ role = "manager", currentUserId = "" }: { role?: "manager" | "artist"; currentUserId?: string }) {
  const { data: profiles = [], isLoading } = useProfiles();
  const { data: projects = [] } = useProjects();
  const { data: directory = [] } = useProjectDirectory();
  const { data: schedule = [] } = useSchedule();
  const { add, update, remove } = useScheduleMutations();
  const [form, setForm] = useState<{ entry: ScheduleEntry | null; userId: string } | null>(null);

  if (isLoading) return <Spinner label="Loading schedule…" />;

  const isManager = role === "manager";
  const artists = profiles.filter((p) => p.role === "artist");
  const canEdit = (uid: string) => isManager || uid === currentUserId;

  const projName = (id: string | null) => directory.find((d) => d.id === id)?.name ?? projects.find((p) => p.id === id)?.name ?? "";
  const projColor = (id: string | null) => directory.find((d) => d.id === id)?.color ?? "#64748b";
  const entryName = (s: ScheduleEntry) => s.activity ?? projName(s.project_id);
  const entryColor = (s: ScheduleEntry) => s.activity ? (SCHEDULE_ACTIVITIES.find((a) => a.name === s.activity)?.color ?? "#64748b") : projColor(s.project_id);

  // Projects available to schedule (assigned ones for an artist; all active for a manager)
  const active = projects.filter((p) => !p.archived && p.status !== "Closed" && (isManager || p.users.includes(currentUserId)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl" style={{ color: "#f1f5f9" }}>Schedule</h1>
        <button onClick={() => setForm({ entry: null, userId: isManager ? (artists[0]?.id ?? "") : currentUserId })}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold font-body" style={{ background: "#e8795a", color: "#1a0d08" }}>
          <Plus size={15} /> Add
        </button>
      </div>

      {artists.map((a) => {
        const entries = schedule.filter((s) => s.user_id === a.id).sort((x, y) => (x.start_date < y.start_date ? -1 : 1));
        return (
          <div key={a.id} className="rounded-xl border" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
            <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid #1c2734" }}>
              <Avatar id={a.id} name={a.full_name ?? ""} size={24} />
              <span className="font-body font-medium text-sm" style={{ color: "#e2e8f0" }}>{a.full_name ?? "Unnamed"}</span>
              {canEdit(a.id) && (
                <button onClick={() => setForm({ entry: null, userId: a.id })} className="ml-auto rounded-md p-1" style={{ color: "#7b8a9a" }} title="Add for this person"><Plus size={16} /></button>
              )}
            </div>
            <div className="p-2 space-y-1.5">
              {entries.map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ background: "#11181f", border: `1px solid #1c2734`, borderLeft: `3px solid ${entryColor(s)}` }}>
                  <div className="flex-1 min-w-0">
                    <div className="font-body text-sm truncate" style={{ color: "#e2e8f0", fontStyle: s.activity ? "italic" : "normal" }}>{entryName(s)}</div>
                    <div className="font-mono" style={{ fontSize: 11, color: "#7b8a9a" }}>{fmtDM(s.start_date)} – {fmtDM(s.end_date)}</div>
                  </div>
                  {canEdit(a.id) && (
                    <>
                      <button onClick={() => setForm({ entry: s, userId: a.id })} className="rounded-md p-1.5 shrink-0" style={{ color: "#7b8a9a" }}><Pencil size={14} /></button>
                      <button onClick={() => { if (confirm("Remove this schedule entry?")) remove.mutate(s.id); }} className="rounded-md p-1.5 shrink-0" style={{ color: "#7b8a9a" }}><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              ))}
              {entries.length === 0 && <div className="px-2 py-3 text-center font-body text-sm" style={{ color: "#475569" }}>Nothing scheduled.</div>}
            </div>
          </div>
        );
      })}
      {artists.length === 0 && <div className="rounded-xl border px-4 py-8 text-center font-body" style={{ background: "#0f151d", borderColor: "#1c2734", color: "#475569" }}>No artists yet.</div>}

      {form && (
        <EntryForm entry={form.entry} userId={form.userId} isManager={isManager} artists={artists} projects={active}
          onClose={() => setForm(null)}
          onSave={(payload) => {
            if (form.entry) update.mutate({ id: form.entry.id, patch: payload }, { onSuccess: () => setForm(null) });
            else add.mutate({ ...payload, task: null, hours: 0, notes: null } as Omit<ScheduleEntry, "id">, { onSuccess: () => setForm(null) });
          }} />
      )}
    </div>
  );
}

function EntryForm({ entry, userId, isManager, artists, projects, onClose, onSave }: {
  entry: ScheduleEntry | null; userId: string; isManager: boolean;
  artists: { id: string; full_name: string | null }[];
  projects: { id: string; name: string }[];
  onClose: () => void;
  onSave: (p: { project_id: string | null; activity: ScheduleEntry["activity"]; user_id: string; start_date: string; end_date: string }) => void;
}) {
  const initSel = entry?.activity ? ACT + entry.activity : (entry?.project_id ?? projects[0]?.id ?? "");
  const [form, setForm] = useState({
    user_id: userId,
    sel: initSel,
    start_date: entry?.start_date ?? fmtKey(TODAY),
    end_date: entry?.end_date ?? fmtKey(TODAY),
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const isAct = form.sel.startsWith(ACT);
  const ok = form.sel && form.start_date && form.end_date && form.end_date >= form.start_date;
  const save = () => {
    if (!ok) return;
    onSave({
      user_id: form.user_id,
      project_id: isAct ? null : form.sel,
      activity: (isAct ? form.sel.slice(ACT.length) : null) as ScheduleEntry["activity"],
      start_date: form.start_date,
      end_date: form.end_date,
    });
  };
  return (
    <Modal title={entry ? "Edit Schedule Entry" : "Add to Schedule"} onClose={onClose}>
      <div className="space-y-4">
        {isManager && (
          <div><Label>Person</Label>
            <select className={fieldCls} style={fieldStyle} value={form.user_id} onChange={(e) => set("user_id", e.target.value)}>
              {artists.map((a) => <option key={a.id} value={a.id}>{a.full_name ?? "Unnamed"}</option>)}
            </select></div>
        )}
        <div><Label>Project or activity</Label>
          <select className={fieldCls} style={fieldStyle} value={form.sel} onChange={(e) => set("sel", e.target.value)}>
            <optgroup label="Projects">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </optgroup>
            <optgroup label="Activities">
              {SCHEDULE_ACTIVITIES.map((a) => <option key={a.name} value={ACT + a.name}>{a.name}</option>)}
            </optgroup>
          </select></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Start</Label><DateField value={form.start_date} onChange={(v) => set("start_date", v)} /></div>
          <div><Label>End</Label><DateField value={form.end_date} onChange={(v) => set("end_date", v)} /></div>
        </div>
        {!ok && form.end_date < form.start_date && <div className="font-body text-xs" style={{ color: "#f87171" }}>End date can't be before the start date.</div>}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium font-body" style={{ background: "#161f29", color: "#cbd5e1", border: "1px solid #25323f" }}>Cancel</button>
        <button onClick={save} className={`rounded-lg px-3.5 py-2 text-sm font-semibold font-body ${ok ? "" : "opacity-50 pointer-events-none"}`} style={{ background: "#e8795a", color: "#1a0d08" }}>{entry ? "Save" : "Add"}</button>
      </div>
    </Modal>
  );
}
