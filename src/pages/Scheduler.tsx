import { useCallback, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { useProfiles, useProjects, useSchedule, useScheduleMutations, useProjectDirectory } from "../data/hooks";
import { Avatar, GhostButton, Label, fieldCls, fieldStyle, Spinner } from "../components/ui";
import { fmtKey, addDays, TODAY, SCHEDULE_ACTIVITIES } from "../lib/constants";
import type { Profile, ScheduleEntry } from "../lib/types";

// Weekend column tint — a faint cool blue so Sat/Sun stand out clearly from weekdays.
const WEEKEND_BG = "rgba(99,150,210,0.10)";


interface Preview { id: string; start_date: string; end_date: string; }

export function Scheduler({ role = "manager", currentUserId = "" }: { role?: "manager" | "artist"; currentUserId?: string } = {}) {
  const { data: projects = [], isLoading } = useProjects();
  const { data: profiles = [] } = useProfiles();
  const { data: schedule = [] } = useSchedule();
  const { data: directory = [] } = useProjectDirectory();
  const { add, update, remove } = useScheduleMutations();

  const [weekOffset, setWeekOffset] = useState(0);
  const [zoom, setZoom] = useState(1); // board width multiplier (horizontal zoom)
  const [popover, setPopover] = useState<{ entry: ScheduleEntry; x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [chipDrag, setChipDrag] = useState<{ name: string; color: string; x: number; y: number } | null>(null);
  const [dropHint, setDropHint] = useState<{ uid: string; dayIndex: number } | null>(null);
  const dragData = useRef<{ project_id: string | null; activity: string | null } | null>(null);
  const dragRef = useRef<any>(null);
  const chipRef = useRef<{ project_id: string | null; activity: string | null } | null>(null);

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
  // Resolve labels from the directory (visible for ALL projects), falling back to the
  // assigned-projects list, so bars on teammates' rows still show the project name.
  const projColor = (id: string) => directory.find((p) => p.id === id)?.color ?? projects.find((p) => p.id === id)?.color ?? "#64748b";
  const projName = (id: string) => directory.find((p) => p.id === id)?.name ?? projects.find((p) => p.id === id)?.name ?? "";
  const projClient = (id: string) => directory.find((p) => p.id === id)?.client_name ?? "";

  // An entry is either a project or an activity; resolve a label + colour for either.
  const entryName = (s: ScheduleEntry) => s.activity ?? projName(s.project_id ?? "");
  const entryClient = (s: ScheduleEntry) => (s.activity ? "" : projClient(s.project_id ?? ""));
  const entryColor = (s: ScheduleEntry) => {
    if (s.activity) return SCHEDULE_ACTIVITIES.find((a) => a.name === s.activity)?.color ?? "#64748b";
    return projColor(s.project_id ?? "");
  };

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
    add.mutate(
      { project_id: data.project_id, activity: data.activity as ScheduleEntry["activity"], user_id: uid, task: null, start_date: fmtKey(day), end_date: fmtKey(day), hours: 4, notes: null },
      { onError: (err: any) => console.error("Failed to add schedule entry:", err?.message ?? err) }
    );
    dragData.current = null;
  };

  // Resolve which editable row + day column the cursor is over (or null).
  const targetAt = (clientX: number, clientY: number): { uid: string; dayIndex: number } | null => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const track = el?.closest("[data-track]") as HTMLElement | null;
    if (!track || track.dataset.editable !== "1") return null;
    const uid = track.dataset.uid;
    if (!uid) return null;
    const rect = track.getBoundingClientRect();
    const cw = rect.width / 14;
    let i = Math.floor((clientX - rect.left) / cw);
    i = Math.max(0, Math.min(13, i));
    return { uid, dayIndex: i };
  };

  // Pointer-based chip drag (works on desktop + touch, unlike HTML5 drag-and-drop).
  const onChipMove = useCallback((e: PointerEvent) => {
    if (!chipRef.current) return;
    setChipDrag((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev));
    setDropHint(targetAt(e.clientX, e.clientY));
  }, []);

  const onChipUp = useCallback((e: PointerEvent) => {
    window.removeEventListener("pointermove", onChipMove);
    window.removeEventListener("pointerup", onChipUp);
    const c = chipRef.current;
    chipRef.current = null;
    setChipDrag(null);
    setDropHint(null);
    if (!c) return;
    const target = targetAt(e.clientX, e.clientY);
    if (!target) return;
    dragData.current = { project_id: c.project_id, activity: c.activity };
    onCreate(target.uid, addDays(monday, target.dayIndex));
  }, [onChipMove, monday]);

  // Start dragging either a project (project_id) or an activity (activity).
  const onChipDown = (e: React.PointerEvent, payload: { project_id: string | null; activity: string | null; name: string; color: string }) => {
    e.preventDefault();
    // Release implicit pointer capture so elementFromPoint resolves the row under the cursor.
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    chipRef.current = { project_id: payload.project_id, activity: payload.activity };
    setChipDrag({ name: payload.name, color: payload.color, x: e.clientX, y: e.clientY });
    setDropHint(targetAt(e.clientX, e.clientY));
    window.addEventListener("pointermove", onChipMove);
    window.addEventListener("pointerup", onChipUp);
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <button onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))} title="Zoom out"
                className="rounded-md p-1.5" style={{ background: "#161f29", color: "#cbd5e1", border: "1px solid #25323f" }}><ZoomOut size={15} /></button>
              <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} title="Zoom in"
                className="rounded-md p-1.5" style={{ background: "#161f29", color: "#cbd5e1", border: "1px solid #25323f" }}><ZoomIn size={15} /></button>
              {zoom !== 1 && <button onClick={() => setZoom(1)} className="text-xs font-body" style={{ color: "#7b8a9a" }}>Reset</button>}
            </div>
            <span className="font-body text-sm" style={{ color: "#9fb0c0" }}>{days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {days[13].toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          </div>
        </div>

        <div className="rounded-xl border overflow-x-auto" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
          <div style={{ minWidth: Math.round(820 * zoom) }}>
            <div className="flex" style={{ borderBottom: "1px solid #1c2734" }}>
              <div className="px-3 py-2 text-xs font-body shrink-0" style={{ width: 150, color: "#7b8a9a" }}>Artist</div>
              <div className="flex-1 grid" style={{ gridTemplateColumns: "repeat(14, 1fr)" }}>
                {days.map((d, i) => {
                  const weekend = [5, 6].includes((d.getDay() + 6) % 7);
                  const isToday = fmtKey(d) === fmtKey(TODAY);
                  return (
                    <div key={i} className="px-1 py-2 text-center" style={{ borderLeft: i === 0 ? "none" : weekend ? "1px solid #223247" : "1px solid #141c25", background: weekend ? WEEKEND_BG : "transparent" }}>
                      <div className="text-xs font-body" style={{ color: weekend ? "#6f8bb0" : "#64748b", fontWeight: weekend ? 600 : 400 }}>{["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"][(d.getDay() + 6) % 7]}</div>
                      <div className="font-mono text-xs" style={{ color: isToday ? "#e8795a" : weekend ? "#8aa0c0" : "#9fb0c0" }}>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {artists.map((a) => (
              <ArtistRow key={a.id} artist={a} days={days} monday={monday} entries={view.filter((s) => s.user_id === a.id)}
                editable={canEditRow(a.id)} isSelf={!isManager && a.id === currentUserId}
                dropDayIndex={dropHint && dropHint.uid === a.id ? dropHint.dayIndex : null}
                dropColor={chipDrag?.color ?? "#e8795a"}
                entryColor={entryColor} entryName={entryName} entryClient={entryClient} onResizeStart={onResizeStart} />
            ))}
            {artists.length === 0 && <div className="px-3 py-6 font-body text-sm" style={{ color: "#475569" }}>No artists yet.</div>}
          </div>
        </div>
        <p className="mt-2 text-xs font-body" style={{ color: "#64748b" }}>
          {isManager
            ? "Drag a project onto a row to schedule it. Drag a bar's ends to change length, its middle to move. Click a bar to add a note or remove it."
            : "This is the whole studio's week. Drag a project onto your row to plan your time, drag your bars to adjust, click one to add a note or remove it. Other people's rows are view-only."}
        </p>
      </div>

      <div className="lg:w-72 shrink-0 space-y-3">
        <div className="rounded-xl border" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
          <div className="px-4 py-3 font-display text-sm" style={{ color: "#e2e8f0", borderBottom: "1px solid #1c2734" }}>Project Library</div>
          <div className="overflow-y-auto p-2 space-y-1.5" style={{ maxHeight: 420 }}>
            {active.map((p) => (
              <div key={p.id} onPointerDown={(e) => onChipDown(e, { project_id: p.id, activity: null, name: p.name, color: p.color ?? "#64748b" })}
                className="flex items-center gap-2 px-2.5 py-2 rounded-md text-sm font-body cursor-grab active:cursor-grabbing select-none"
                style={{ background: `${p.color}1a`, color: "#e2e8f0", border: `1px solid ${p.color}40`, touchAction: "none" }}>
                <GripVertical size={13} style={{ color: "#64748b" }} />
                <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: p.color ?? "#64748b" }} />
                <span className="min-w-0 flex-1 leading-tight">
                  {projClient(p.id) && (
                    <span className="block truncate font-body" style={{ fontSize: 10, color: "#7b8a9a", textTransform: "uppercase", letterSpacing: "0.04em" }}>{projClient(p.id)}</span>
                  )}
                  <span className="block truncate">{p.name}</span>
                </span>
              </div>
            ))}
            {active.length === 0 && (
              <div className="px-2 py-3 text-xs font-body" style={{ color: "#475569" }}>
                {isManager ? "No active projects." : "You're not assigned to any active projects yet."}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
          <div className="px-4 py-3 font-display text-sm" style={{ color: "#e2e8f0", borderBottom: "1px solid #1c2734" }}>Activities</div>
          <div className="p-2 space-y-1.5">
            {SCHEDULE_ACTIVITIES.map((a) => (
              <div key={a.name} onPointerDown={(e) => onChipDown(e, { project_id: null, activity: a.name, name: a.name, color: a.color })}
                className="flex items-center gap-2 px-2.5 py-2 rounded-md text-sm font-body cursor-grab active:cursor-grabbing select-none"
                style={{ background: `${a.color}1a`, color: "#e2e8f0", border: `1px solid ${a.color}40`, touchAction: "none" }}>
                <GripVertical size={13} style={{ color: "#64748b" }} />
                <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: a.color }} />
                <span className="truncate">{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {popover && (
        <div className="fixed inset-0 z-50" onMouseDown={() => setPopover(null)}>
          <div onMouseDown={(e) => e.stopPropagation()} className="absolute rounded-xl border p-3 w-64 font-body"
            style={{ left: Math.min(popover.x, window.innerWidth - 280), top: Math.min(popover.y, window.innerHeight - 220), background: "#0f151d", borderColor: "#25323f", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-full" style={{ width: 8, height: 8, background: entryColor(popover.entry) }} />
              <span className="text-sm" style={{ color: "#f1f5f9" }}>{entryName(popover.entry)}</span>
            </div>
            {popover.entry.task && <div className="text-xs mb-3" style={{ color: "#9fb0c0" }}>{popover.entry.task}</div>}
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

      {chipDrag && (
        <div className="fixed z-50 pointer-events-none flex items-center gap-2 px-2.5 py-2 rounded-md text-sm font-body"
          style={{ left: chipDrag.x + 12, top: chipDrag.y + 12, background: "#0f151d", color: "#e2e8f0", border: `1px solid ${chipDrag.color}`, boxShadow: "0 10px 30px rgba(0,0,0,0.5)", opacity: 0.95 }}>
          <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: chipDrag.color }} />
          <span className="truncate" style={{ maxWidth: 180 }}>{chipDrag.name}</span>
        </div>
      )}
    </div>
  );
}

function ArtistRow({ artist, days, monday, entries, editable, isSelf, dropDayIndex, dropColor, entryColor, entryName, entryClient, onResizeStart }: {
  artist: Profile; days: Date[]; monday: Date; entries: ScheduleEntry[];
  editable: boolean; isSelf: boolean;
  dropDayIndex: number | null; dropColor: string;
  entryColor: (s: ScheduleEntry) => string; entryName: (s: ScheduleEntry) => string; entryClient: (s: ScheduleEntry) => string;
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
  const ROW = 44, PAD = 6;
  // When a drop is being previewed on this row, reserve an extra lane at the bottom for it.
  const showHint = dropDayIndex !== null;
  const hintLane = lanes.length;
  const height = Math.max(1, lanes.length + (showHint ? 1 : 0)) * ROW + PAD * 2;

  return (
    <div className="flex" style={{ borderTop: "2px solid #28384a", background: isSelf ? "rgba(232,121,90,0.05)" : "transparent" }}>
      <div className="px-3 flex items-center gap-2 shrink-0" style={{ width: 150 }}>
        <Avatar id={artist.id} name={artist.full_name ?? ""} size={24} />
        <span className="font-body text-sm truncate" style={{ color: editable ? "#cbd5e1" : "#7b8a9a" }}>{(artist.full_name ?? "").split(" ")[0]}</span>
        {isSelf && <span className="rounded-full px-1.5 py-0.5 font-body" style={{ fontSize: 9, background: "rgba(232,121,90,0.16)", color: "#e8a48e" }}>you</span>}
      </div>
      <div ref={trackRef} data-track data-uid={artist.id} data-editable={editable ? "1" : "0"} className="flex-1 relative" style={{ height }}>
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: "repeat(14, 1fr)", pointerEvents: "none" }}>
          {days.map((d, i) => {
            const weekend = [5, 6].includes((d.getDay() + 6) % 7);
            const hinted = showHint && i === dropDayIndex;
            return (
              <div key={i} className="relative" style={{ borderLeft: i === 0 ? "none" : weekend ? "1px solid #223247" : "1px solid #141c25", background: hinted ? `${dropColor}22` : weekend ? WEEKEND_BG : "transparent" }} />
            );
          })}
        </div>
        {segs.map((o) => {
          const vis = Math.max(0, o.a), vise = Math.min(13, o.b);
          const left = (vis / 14) * 100, width = ((vise - vis + 1) / 14) * 100;
          const c = entryColor(o.s);
          const clipL = o.a < 0, clipR = o.b > 13;
          return (
            <div key={o.s.id} className="absolute" style={{ left: `${left}%`, width: `${width}%`, top: o.lane * ROW + PAD, height: ROW - 6, padding: "0 1px" }}>
              <div onPointerDown={editable ? (e) => onResizeStart(e, o.s, "move") : undefined}
                className="h-full rounded-md font-body flex flex-col justify-center px-2 relative overflow-hidden select-none leading-tight"
                style={{ background: editable ? `${c}33` : `${c}26`, color: editable ? "#e6edf3" : "#dbe4ec", borderLeft: `3px solid ${editable ? c : c + "aa"}`, cursor: editable ? "grab" : "default", opacity: 1 }}>
                {editable && !clipL && <div onPointerDown={(e) => onResizeStart(e, o.s, "left")} className="absolute left-0 top-0 h-full" style={{ width: 9, cursor: "ew-resize" }} />}
                {entryClient(o.s) && (
                  <span className="truncate pointer-events-none" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.04em", color: editable ? "#aebccb" : "#9fb0c0" }}>{entryClient(o.s)}</span>
                )}
                <span className="truncate pointer-events-none text-xs">{entryName(o.s)}</span>
                {editable && !clipR && <div onPointerDown={(e) => onResizeStart(e, o.s, "right")} className="absolute right-0 top-0 h-full" style={{ width: 9, cursor: "ew-resize" }} />}
              </div>
            </div>
          );
        })}
        {showHint && (
          <div className="absolute pointer-events-none" style={{ left: `${(dropDayIndex! / 14) * 100}%`, width: `${(1 / 14) * 100}%`, top: hintLane * ROW + PAD, height: ROW - 6, padding: "0 1px" }}>
            <div className="h-full rounded-md flex items-center justify-center" style={{ background: `${dropColor}55`, border: `1.5px dashed ${dropColor}`, boxShadow: `0 0 0 2px ${dropColor}22` }}>
              <span className="font-mono" style={{ fontSize: 10, color: "#fff" }}>drop here</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
