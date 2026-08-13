import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useProfiles, useProjects, useSchedule, useScheduleMutations, useProjectDirectory } from "../data/hooks";
import { Avatar, Modal, Label, fieldCls, fieldStyle, DateField, Spinner } from "./ui";
import { SCHEDULE_ACTIVITIES, fmtKey, addDays, TODAY } from "../lib/constants";
import type { ScheduleEntry } from "../lib/types";

const ACT = "activity:";
const mondayOf = (d: Date) => addDays(d, -(((d.getDay() + 6) % 7)));

export function SchedulerMobile({ role = "manager", currentUserId = "" }: { role?: "manager" | "artist"; currentUserId?: string }) {
  const { data: profiles = [], isLoading } = useProfiles();
  const { data: projects = [] } = useProjects();
  const { data: directory = [] } = useProjectDirectory();
  const { data: schedule = [] } = useSchedule();
  const { add, update, remove } = useScheduleMutations();
  const [weekOffset, setWeekOffset] = useState(0);
  const [form, setForm] = useState<{ entry: ScheduleEntry | null; userId: string } | null>(null);

  if (isLoading) return <Spinner label="Loading schedule…" />;

  const isManager = role === "manager";
  const artists = profiles.filter((p) => p.role === "artist");
  const canEdit = (uid: string) => isManager || uid === currentUserId;
  const nameOf = (uid: string) => profiles.find((p) => p.id === uid)?.full_name ?? "Unknown";

  const projName = (id: string | null) => directory.find((d) => d.id === id)?.name ?? projects.find((p) => p.id === id)?.name ?? "";
  const projColor = (id: string | null) => directory.find((d) => d.id === id)?.color ?? "#64748b";
  const entryName = (s: ScheduleEntry) => s.activity ?? projName(s.project_id);
  const entryColor = (s: ScheduleEntry) => s.activity ? (SCHEDULE_ACTIVITIES.find((a) => a.name === s.activity)?.color ?? "#64748b") : projColor(s.project_id);

  const active = projects.filter((p) => !p.archived && p.status !== "Closed" && (isManager || p.users.includes(currentUserId)));

  const weekStart = addDays(mondayOf(TODAY), weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const rangeLabel = `${weekStart.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
  const fmtRange = (s: ScheduleEntry) => {
    const a = new Date(s.start_date + "T00:00:00"), b = new Date(s.end_date + "T00:00:00");
    return `${a.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${b.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
  };
  const entriesOn = (d: Date) => {
    const k = fmtKey(d);
    return schedule.filter((s) => s.start_date <= k && s.end_date >= k)
      .sort((x, y) => nameOf(x.user_id).localeCompare(nameOf(y.user_id)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl" style={{ color: "#f1f5f9" }}>Schedule</h1>
        <button onClick={() => setForm({ entry: null, userId: isManager ? (artists[0]?.id ?? "") : currentUserId })}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold font-body" style={{ background: "#e8795a", color: "#1a0d08" }}>
          <Plus size={15} /> Add
        </button>
      </div>

      <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "#0f151d", border: "1px solid #1c2734" }}>
        <button onClick={() => setWeekOffset((w) => w - 1)} className="rounded-md p-1" style={{ color: "#9fb0c0" }}><ChevronLeft size={18} /></button>
        <div className="text-center">
          <div className="font-body text-sm font-medium" style={{ color: "#e2e8f0" }}>{weekOffset === 0 ? "This week" : rangeLabel}</div>
          {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} className="font-body" style={{ fontSize: 11, color: "#7b8a9a" }}>Back to this week</button>}
        </div>
        <button onClick={() => setWeekOffset((w) => w + 1)} className="rounded-md p-1" style={{ color: "#9fb0c0" }}><ChevronRight size={18} /></button>
      </div>

      <div className="space-y-3">
        {days.map((d) => {
          const items = entriesOn(d);
          const isToday = fmtKey(d) === fmtKey(TODAY);
          const isWeekend = [5, 6].includes((d.getDay() + 6) % 7);
          return (
            <div key={fmtKey(d)}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-body text-sm font-medium" style={{ color: isToday ? "#e8795a" : isWeekend ? "#6f8bb0" : "#cbd5e1" }}>
                  {d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                </span>
                {isToday && <span className="rounded-full px-2 py-0.5 font-body" style={{ fontSize: 10, background: "rgba(232,121,90,0.15)", color: "#e8795a" }}>Today</span>}
              </div>
              {items.length === 0 ? (
                <div className="rounded-lg px-3 py-2 font-body text-sm" style={{ background: "#0d131a", border: "1px solid #141c25", color: "#475569" }}>—</div>
              ) : (
                <div className="space-y-1.5">
                  {items.map((s) => (
                    <div key={s.id} onClick={() => canEdit(s.user_id) && setForm({ entry: s, userId: s.user_id })}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2"
                      style={{ background: "#0f151d", border: "1px solid #1c2734", borderLeft: `3px solid ${entryColor(s)}`, cursor: canEdit(s.user_id) ? "pointer" : "default" }}>
                      <Avatar id={s.user_id} name={nameOf(s.user_id)} size={24} />
                      <div className="flex-1 min-w-0">
                        <div className="font-body text-sm truncate" style={{ color: "#e2e8f0", fontStyle: s.activity ? "italic" : "normal" }}>{entryName(s)}</div>
                        <div className="font-mono truncate" style={{ fontSize: 11, color: "#7b8a9a" }}>{nameOf(s.user_id)} · {fmtRange(s)}</div>
                      </div>
                      {canEdit(s.user_id) && <Pencil size={13} className="shrink-0" style={{ color: "#64748b" }} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {form && (
        <EntryForm entry={form.entry} userId={form.userId} isManager={isManager} artists={artists} projects={active}
          onClose={() => setForm(null)}
          onDelete={form.entry ? () => remove.mutate(form.entry!.id, { onSuccess: () => setForm(null) }) : undefined}
          onSave={(payload) => {
            if (form.entry) update.mutate({ id: form.entry.id, patch: payload }, { onSuccess: () => setForm(null) });
            else add.mutate({ ...payload, task: null, hours: 0, notes: null } as Omit<ScheduleEntry, "id">, { onSuccess: () => setForm(null) });
          }} />
      )}
    </div>
  );
}

function EntryForm({ entry, userId, isManager, artists, projects, onClose, onSave, onDelete }: {
  entry: ScheduleEntry | null; userId: string; isManager: boolean;
  artists: { id: string; full_name: string | null }[];
  projects: { id: string; name: string }[];
  onClose: () => void;
  onSave: (p: { project_id: string | null; activity: ScheduleEntry["activity"]; user_id: string; start_date: string; end_date: string }) => void;
  onDelete?: () => void;
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
      <div className="mt-6 flex items-center gap-2">
        {onDelete && (
          <button onClick={() => { if (confirm("Remove this schedule entry?")) onDelete(); }} className="rounded-lg p-2" style={{ color: "#f87171", border: "1px solid #3a2020" }} title="Delete"><Trash2 size={16} /></button>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium font-body" style={{ background: "#161f29", color: "#cbd5e1", border: "1px solid #25323f" }}>Cancel</button>
          <button onClick={save} className={`rounded-lg px-3.5 py-2 text-sm font-semibold font-body ${ok ? "" : "opacity-50 pointer-events-none"}`} style={{ background: "#e8795a", color: "#1a0d08" }}>{entry ? "Save" : "Add"}</button>
        </div>
      </div>
    </Modal>
  );
}
