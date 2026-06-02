import { useCallback, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical, AlertTriangle, Trash2 } from "lucide-react";
import { useProfiles, useProjects, useSchedule, useScheduleMutations } from "../data/hooks";
import { Avatar, GhostButton, Label, fieldCls, fieldStyle, Spinner } from "../components/ui";
import { fmtKey, addDays, TODAY } from "../lib/constants";
import type { Profile, ScheduleEntry } from "../lib/types";

interface Preview { id: string; start_date: string; end_date: string; }

export function Scheduler({ role = "manager", currentUserId = "" }: { role?: "manager" | "artist"; currentUserId?: string } = {}) {
  const { data: projects = [], isLoading } = useProjects();
  const { data: profiles = [] } = useProfiles();
  const { data: schedule = [] } = useSchedule();
  const { add, update, remove } = useScheduleMutations();

  const [weekOffset, setWeekOffset] = useState(0);
  const [popover, setPopover] = useState<{ entry: ScheduleEntry; x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const dragData = useRef<{ project_id: string } | null>(null);
  const dragRef = useRef<any>(null);

  const isManager = role === "manager";
  // An artist may only edit their own row; managers may edit every row.
  const canEditRow = (uid: string) => isManager || uid === currentUserId;

  const allArtists = profiles.filter((p) => p.role === "artist");
  // Artists see the whole studio board, but their own row is sorted to the top.
  const artists = isManager
    ? allArtists
    : [...allArtists].sort((a, b) => (a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : 0));

  const monday = useMemo(() => {
    const day = (TODAY.getDay() + 6) % 7;
    return addDays(addDays(TODAY, -day), weekOffset * 7);
  }, [weekOffset]);
  const days = Array.from({ length: 14 }, (_, i) => addDays(monday, i));
  // Task library: managers see all active projects; artists only their assigned ones.
  const active = projects.filter((p) => !p.archived && p.status !== "Closed" && (isManager || p.users.includes(currentUserId)));
  const projColor = (id: string) => projects.find((p) => p.id === id)?.color ?? "#64748b";
  const projName = (id: string) => projects.find((p) => p.id === id)?.name ?? "";

  // merge live preview into the schedule for rendering
  const view = schedule.map((s) => (preview && preview.id === s.id ? { ...s, start_date: preview.start_date, end_date: preview.end_date } : s));

  const onMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current; if (!d) return;
    if (Math.abs(e.clientX - d.startX) > 3) d.moved = true;
    const delta = Math.round((e.clientX - d.startX) / d.cellW);
    let start = new Date(d.os), end = new Date(d.oe);
    if (d.mode === "move") { start = addDays(d.os, delta); end = addDays(d.oe, delta); }
    else if (d.mode === "left") { start = addDays(d.os, delta); if (start > end) start = new Date(end); }
    else if (d.mode === "right") { end = addDays(d.oe, delta); if (end < start) end = new Date(start); }
    setPreview({ id: d.id, start_date: fmtKey(start), end_date: fmtKey(end) });
  }, []);

  const onUp = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (!d) return;
    if (d.mode === "move" && !d.moved) {
      setPreview(null);
      setPopover({ entry: d.entry, x: e.clientX, y: e.clientY });
    } else {
      const p = previewRef.current;
      if (p && p.id === d.id) update.mutate({ id: d.id, patch: { start_date: p.start_date, end_date: p.end_date } });
      setPreview(null);
    }
    dragRef.current = null;
  }, [onMove, update]);

  // keep a ref of latest preview for onUp
  const previewRef = useRef<Preview | null>(null);
  previewRef.current = preview;

  const onResizeStart = (e: React.PointerEvent, entry: ScheduleEntry, mode: "move" | "left" | "right") => {
    e.preventDefault(); e.stopPropagation();
    const track = (e.currentTarget as HTMLElement).closest("[data-track]") as HTMLElement | null;
    if (!track) return;
    const cellW = track.getBoundingClientRect().width / 14;
    dragRef.current = {
      id: entry.id, mode, startX: e.clientX, cellW, moved: false, entry,
      os: new Date(entry.start_date + "T00:00:00"), oe: new Date(entry.end_date + "T00:00:00"),
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onCreate = (uid: string, day: Date) => {
    const data = dragData.current; if (!data) return;
    add.mutate({ project_id: data.project_id, user_id: uid, task: null, start_date: fmtKey(day), end_date: fmtKey(day), hours: 4, notes: null });
    dragData.current = null;
  };

  if (isLoading) return <Spinner label="Loading scheduler…" />;

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GhostButton onClick={() => setWeekOffset((w) => w - 1)} title="Previous week"><ChevronLeft size={16} /></GhostButton>
            <GhostButton onClick={() => setWeekOffset((w) => w + 1)} title="Next week"><ChevronRight size={16} /></GhostButton>
            {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} className="text-xs font-body" style={{ color: "#7b8a9a" }}>Today</button>}
          </div>
          <span className="font-body text-sm" style={{ color: "#9fb0c0" }}>{days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {days[13].toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        </div>

        <div className="rounded-xl border overflow-x-auto" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
          <div style={{ minWidth: 980 }}>
            <div className="flex" style={{ borderBottom: "1px solid #1c2734" }}>
              <div className="px-3 py-2 text-xs font-body shrink-0" style={{ width: 150, color: "#7b8a9a" }}>Artist</div>
              <div className="flex-1 grid" style={{ gridTemplateColumns: "repeat(14, 1fr)" }}>
                {days.map((d, i) => {
                  const weekend = [5, 6].includes((d.getDay() + 6) % 7);
                  const isToday = fmtKey(d) === fmtKey(TODAY);
                  return (
                    <div key={i} className="px-1 py-2 text-center" style={{ borderLeft: "1px solid #141c25", background: weekend ? "#0c1219" : "transparent" }}>
                      <div className="text-xs font-body" style={{ color: "#64748b" }}>{["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"][(d.getDay() + 6) % 7]}</div>
                      <div className="font-mono text-xs" style={{ color: isToday ? "#e8795a" : "#9fb0c0" }}>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {artists.map((a) => (
              <ArtistRow key={a.id} artist={a} days={days} monday={monday} entries={view.filter((s) => s.user_id === a.id)}
                editable={canEditRow(a.id)} isSelf={!isManager && a.id === currentUserId}
                projColor={projColor} projName={projName} onCreate={onCreate} onResizeStart={onResizeStart} />
            ))}
            {artists.length === 0 && <div className="px-3 py-6 font-body text-sm" style={{ color: "#475569" }}>No artists yet.</div>}
          </div>
        </div>
        <p className="mt-2 text-xs font-body" style={{ color: "#64748b" }}>
          {isManager
            ? "Drag a project onto a row to schedule it. Drag a bar's ends to change length, its middle to move. Click a bar to edit hours or remove. Days turn red over 8h."
            : "This is the whole studio's week. Drag a project onto your row to plan your time, drag your bars to adjust, click one to edit or remove. Other people's rows are view-only. Days turn red over 8h."}
        </p>
      </div>

      <div className="lg:w-72 shrink-0">
        <div className="rounded-xl border" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
          <div className="px-4 py-3 font-display text-sm" style={{ color: "#e2e8f0", borderBottom: "1px solid #1c2734" }}>Project Library</div>
          <div className="overflow-y-auto p-2 space-y-1.5" style={{ maxHeight: 520 }}>
            {active.map((p) => (
              <div key={p.id} draggable onDragStart={() => { dragData.current = { project_id: p.id }; }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-md text-sm font-body cursor-grab active:cursor-grabbing"
                style={{ background: `${p.color}1a`, color: "#e2e8f0", border: `1px solid ${p.color}40` }}>
                <GripVertical size={13} style={{ color: "#64748b" }} />
                <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: p.color ?? "#64748b" }} />
                <span className="truncate">{p.name}</span>
              </div>
            ))}
            {active.length === 0 && (
              <div className="px-2 py-3 text-xs font-body" style={{ color: "#475569" }}>
                {isManager ? "No active projects." : "You're not assigned to any active projects yet."}
              </div>
            )}
          </div>
        </div>
      </div>

      {popover && (
        <div className="fixed inset-0 z-50" onMouseDown={() => setPopover(null)}>
          <div onMouseDown={(e) => e.stopPropagation()} className="absolute rounded-xl border p-3 w-64 font-body"
            style={{ left: Math.min(popover.x, window.innerWidth - 280), top: Math.min(popover.y, window.innerHeight - 220), background: "#0f151d", borderColor: "#25323f", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-full" style={{ width: 8, height: 8, background: projColor(popover.entry.project_id) }} />
              <span className="text-sm" style={{ color: "#f1f5f9" }}>{projName(popover.entry.project_id)}</span>
            </div>
            {popover.entry.task && <div className="text-xs mb-3" style={{ color: "#9fb0c0" }}>{popover.entry.task}</div>}
            <Label>Hours</Label>
            <input type="number" step="0.5" min="0.5" max="24" className={fieldCls + " mb-3"} style={fieldStyle}
              defaultValue={popover.entry.hours} onChange={(e) => update.mutate({ id: popover.entry.id, patch: { hours: +e.target.value } })} />
            <Label>Notes</Label>
            <input className={fieldCls + " mb-3"} style={fieldStyle} defaultValue={popover.entry.notes ?? ""}
              onChange={(e) => update.mutate({ id: popover.entry.id, patch: { notes: e.target.value } })} placeholder="optional" />
            <button onClick={() => { remove.mutate(popover.entry.id); setPopover(null); }} className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-2 text-sm"
              style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ArtistRow({ artist, days, monday, entries, editable, isSelf, projColor, projName, onCreate, onResizeStart }: {
  artist: Profile; days: Date[]; monday: Date; entries: ScheduleEntry[];
  editable: boolean; isSelf: boolean;
  projColor: (id: string) => string; projName: (id: string) => string; onCreate: (uid: string, d: Date) => void;
  onResizeStart: (e: React.PointerEvent, entry: ScheduleEntry, mode: "move" | "left" | "right") => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dayMs = 86400000;
  const idxOf = (ds: string) => Math.round((new Date(ds + "T00:00:00").getTime() - monday.getTime()) / dayMs);

  const segs = entries
    .map((s) => ({ s, a: idxOf(s.start_date), b: idxOf(s.end_date), lane: 0 }))
    .filter((o) => o.b >= 0 && o.a <= 13)
    .sort((x, y) => x.a - y.a || x.b - y.b);

  const lanes: number[] = [];
  segs.forEach((o) => {
    let placed = false;
    for (let li = 0; li < lanes.length; li++) {
      if (lanes[li] < o.a) { o.lane = li; lanes[li] = o.b; placed = true; break; }
    }
    if (!placed) { o.lane = lanes.length; lanes.push(o.b); }
  });
  const ROW = 30, PAD = 6;
  const height = Math.max(1, lanes.length) * ROW + PAD * 2;

  const dayHours = days.map((d) => {
    const k = fmtKey(d);
    return entries.filter((s) => s.start_date <= k && s.end_date >= k).reduce((acc, s) => acc + (s.hours || 0), 0);
  });

  return (
    <div className="flex" style={{ borderTop: "1px solid #141c25", background: isSelf ? "rgba(232,121,90,0.05)" : "transparent" }}>
      <div className="px-3 flex items-center gap-2 shrink-0" style={{ width: 150 }}>
        <Avatar id={artist.id} name={artist.full_name ?? ""} size={24} />
        <span className="font-body text-sm truncate" style={{ color: editable ? "#cbd5e1" : "#7b8a9a" }}>{(artist.full_name ?? "").split(" ")[0]}</span>
        {isSelf && <span className="rounded-full px-1.5 py-0.5 font-body" style={{ fontSize: 9, background: "rgba(232,121,90,0.16)", color: "#e8a48e" }}>you</span>}
      </div>
      <div ref={trackRef} data-track className="flex-1 relative" style={{ height }}
        onDragOver={(e) => { if (editable) e.preventDefault(); }}
        onDrop={(e) => {
          if (!editable) return;
          const rect = trackRef.current!.getBoundingClientRect();
          const cw = rect.width / 14;
          let i = Math.floor((e.clientX - rect.left) / cw);
          i = Math.max(0, Math.min(13, i));
          onCreate(artist.id, addDays(monday, i));
        }}>
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: "repeat(14, 1fr)" }}>
          {days.map((d, i) => {
            const weekend = [5, 6].includes((d.getDay() + 6) % 7);
            const ob = dayHours[i] > 8;
            return (
              <div key={i} className="relative" style={{ borderLeft: "1px solid #141c25", background: ob ? "rgba(248,113,113,0.08)" : weekend ? "#0c1219" : "transparent" }}>
                {ob && <AlertTriangle size={10} className="absolute" style={{ top: 2, right: 2, color: "#f87171" }} />}
              </div>
            );
          })}
        </div>
        {segs.map((o) => {
          const vis = Math.max(0, o.a), vise = Math.min(13, o.b);
          const left = (vis / 14) * 100, width = ((vise - vis + 1) / 14) * 100;
          const c = projColor(o.s.project_id);
          const clipL = o.a < 0, clipR = o.b > 13;
          return (
            <div key={o.s.id} className="absolute" style={{ left: `${left}%`, width: `${width}%`, top: o.lane * ROW + PAD, height: ROW - 6, padding: "0 1px" }}>
              <div onPointerDown={editable ? (e) => onResizeStart(e, o.s, "move") : undefined}
                className="h-full rounded-md text-xs font-body flex items-center px-2 relative overflow-hidden select-none"
                style={{ background: editable ? `${c}33` : `${c}1f`, color: editable ? "#e6edf3" : "#9fb0c0", borderLeft: `3px solid ${editable ? c : c + "88"}`, cursor: editable ? "grab" : "default", opacity: editable ? 1 : 0.85 }}>
                {editable && !clipL && <div onPointerDown={(e) => onResizeStart(e, o.s, "left")} className="absolute left-0 top-0 h-full" style={{ width: 9, cursor: "ew-resize" }} />}
                <span className="truncate pointer-events-none">{projName(o.s.project_id)} · {o.s.hours}h</span>
                {editable && !clipR && <div onPointerDown={(e) => onResizeStart(e, o.s, "right")} className="absolute right-0 top-0 h-full" style={{ width: 9, cursor: "ew-resize" }} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
