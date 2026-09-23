import { useState, useRef, useEffect, type ReactNode } from "react";
import { X, Check, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { initialsOf, avatarColor, STATUS_STYLES, healthColor, fmtKey, fmtDM } from "../lib/constants";
import type { ProjectStatus } from "../lib/types";

export function Avatar({ id, name, size = 28, ring = false, color, title, ringColor }: {
  id: string; name: string; size?: number; ring?: boolean; color?: string | null; title?: string; ringColor?: string;
}) {
  const bg = color || avatarColor(id);
  return (
    <div
      title={title ?? name}
      className="inline-flex items-center justify-center rounded-full font-semibold shrink-0 font-body"
      style={{
        width: size, height: size, fontSize: size * 0.38,
        background: bg, color: "#0b0f14",
        boxShadow: ring ? `0 0 0 2px ${ringColor ?? "#0d1117"}` : "none",
      }}
    >
      {initialsOf(name)}
    </div>
  );
}

// Overlapping avatar stack: up to `max` avatars then "+N", −6px overlap, 2px ring
// in the background colour so initials stay readable. `people` carry their stored colour.
export function AvatarStack({ people, size = 24, max = 3, ringColor = "#0f151d" }: {
  people: { id: string; name: string; color?: string | null; title?: string }[];
  size?: number; max?: number; ringColor?: string;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center" style={{ paddingLeft: 6 }}>
      {shown.map((p, i) => (
        <div key={p.id} style={{ marginLeft: -6, zIndex: i + 1 }}>
          <Avatar id={p.id} name={p.name} size={size} ring ringColor={ringColor} color={p.color} title={p.title} />
        </div>
      ))}
      {extra > 0 && (
        <div style={{ marginLeft: -6, zIndex: max + 1 }} title={people.slice(max).map((p) => p.title ?? p.name).join(", ")}>
          <span className="inline-flex items-center justify-center rounded-full font-semibold font-body"
            style={{ width: size, height: size, fontSize: size * 0.34, background: "#25323f", color: "#cbd5e1", boxShadow: `0 0 0 2px ${ringColor}` }}>+{extra}</span>
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.Upcoming;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium font-body whitespace-nowrap"
      style={{ background: s.bg, color: s.fg }}>
      <span className="rounded-full" style={{ width: 6, height: 6, background: s.dot }} />
      {status}
    </span>
  );
}

export function ProgressBar({ current, est, height = 6 }: { current: number; est: number; height?: number }) {
  const pct = est > 0 ? Math.min((current / est) * 100, 100) : 0;
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: "#1e2733" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: healthColor(current, est) }} />
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      style={{ background: "rgba(3,6,10,0.7)", backdropFilter: "blur(3px)" }} onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()}
        className="relative my-6 w-full rounded-2xl border font-body"
        style={{ maxWidth: wide ? 760 : 480, background: "#0f151d", borderColor: "#22303d", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#1c2734" }}>
          <h3 className="font-display text-lg" style={{ color: "#f1f5f9" }}>{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5" style={{ color: "#7b8a9a" }}><X size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export const fieldCls = "w-full rounded-lg px-3 py-2 text-sm font-body";
export const fieldStyle = { background: "#0a0f15", border: "1px solid #25323f", color: "#e2e8f0" } as const;

export function Label({ children }: { children: ReactNode }) {
  return <label className="block text-xs font-medium mb-1.5 font-body" style={{ color: "#9fb0c0" }}>{children}</label>;
}

export function PrimaryButton({ children, onClick, className = "", type = "button" }: { children: ReactNode; onClick?: () => void; className?: string; type?: "button" | "submit" }) {
  return (
    <button type={type} onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold font-body active:scale-95 transition-transform ${className}`}
      style={{ background: "#e8795a", color: "#1a0d08" }}>
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, className = "", title }: { children: ReactNode; onClick?: () => void; className?: string; title?: string }) {
  return (
    <button onClick={onClick} title={title}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium font-body ${className}`}
      style={{ background: "#161f29", color: "#cbd5e1", border: "1px solid #25323f" }}>
      {children}
    </button>
  );
}

export function TaskCheckbox({ done, onClick, color = "#e8795a" }: { done: boolean; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick} className="shrink-0 rounded-md flex items-center justify-center"
      style={{ width: 18, height: 18, border: `1.5px solid ${done ? color : "#3a4654"}`, background: done ? color : "transparent" }}>
      {done && <Check size={12} style={{ color: "#0b0f14" }} strokeWidth={3} />}
    </button>
  );
}

export function SummaryCard({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: ReactNode; sub?: string; accent: string }) {
  return (
    <div className="rounded-xl border p-4 flex flex-col gap-2" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase font-body" style={{ color: "#7b8a9a", letterSpacing: "0.06em" }}>{label}</span>
        <span className="rounded-lg p-1.5" style={{ background: `${accent}1f`, color: accent }}><Icon size={16} /></span>
      </div>
      <div className="font-display text-3xl" style={{ color: "#f1f5f9" }}>{value}</div>
      {sub && <div className="text-xs font-body" style={{ color: "#64748b" }}>{sub}</div>}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <div className="p-8 text-center font-body" style={{ color: "#64748b" }}>{label}</div>;
}

// Date picker: a field that opens a themed month-view calendar on click.
// value is an ISO yyyy-mm-dd string ("" = none); onChange returns the same ("" when cleared).
export function DateField({ value, onChange, placeholder = "Select date", clearable = false }: {
  value: string; onChange: (iso: string) => void; placeholder?: string; clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const base = value ? new Date(value + "T00:00:00") : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // when opening, jump the calendar to the selected month
  useEffect(() => {
    if (open && value) { const d = new Date(value + "T00:00:00"); setView(new Date(d.getFullYear(), d.getMonth(), 1)); }
  }, [open]); // eslint-disable-line

  const sel = value ? new Date(value + "T00:00:00") : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const year = view.getFullYear(), month = view.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const monthLabel = view.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const pick = (day: number) => { onChange(fmtKey(new Date(year, month, day))); setOpen(false); };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={fieldCls + " text-left flex items-center justify-between"} style={fieldStyle}>
        <span style={{ color: value ? "#e2e8f0" : "#64748b" }}>{value ? fmtDM(value) : placeholder}</span>
        <CalendarIcon size={15} style={{ color: "#7b8a9a" }} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 rounded-xl border p-3" style={{ width: 256, background: "#0f151d", borderColor: "#25323f", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setView(new Date(year, month - 1, 1))} className="rounded-md p-1" style={{ color: "#9fb0c0" }}><ChevronLeft size={16} /></button>
            <span className="font-body text-sm" style={{ color: "#e2e8f0" }}>{monthLabel}</span>
            <button type="button" onClick={() => setView(new Date(year, month + 1, 1))} className="rounded-md p-1" style={{ color: "#9fb0c0" }}><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <div key={d} className="text-center font-body" style={{ fontSize: 10, color: "#64748b" }}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />;
              const d = new Date(year, month, day);
              const isSel = !!sel && fmtKey(d) === fmtKey(sel);
              const isToday = fmtKey(d) === fmtKey(today);
              return (
                <button key={i} type="button" onClick={() => pick(day)} className="rounded-md text-center font-body py-1.5"
                  style={{ fontSize: 12, background: isSel ? "#e8795a" : "transparent", color: isSel ? "#1a0d08" : "#cbd5e1", fontWeight: isSel ? 600 : 400, boxShadow: !isSel && isToday ? "inset 0 0 0 1px #3a4654" : "none" }}>
                  {day}
                </button>
              );
            })}
          </div>
          {clearable && value && (
            <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="mt-2 w-full rounded-md py-1.5 text-xs font-body" style={{ background: "#161f29", color: "#9fb0c0", border: "1px solid #25323f" }}>Clear date</button>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Shared reporting cells & controls (Phase 3b) --------------------------
import { daysWaiting, waitingColor, isOverdue, overdueDays, daysSince } from "../lib/metrics";

// Archived checkbox — one pattern used wherever archived projects can be shown/hidden.
export function ArchivedToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm font-body cursor-pointer select-none" style={{ color: "#9fb0c0" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> Archived
    </label>
  );
}

// Client review date as a STATE, not just a date (spec Projects §2).
export function ReviewDateCell({ status, reviewDate }: { status: string; reviewDate: string | null }) {
  const waiting = daysWaiting(status, reviewDate);
  if (status === "With Client" && reviewDate) {
    const since = daysSince(reviewDate);
    if (since === 0) return <span className="font-mono text-xs" style={{ color: "#7b8a9a" }}>Sent today</span>;
    if (waiting !== null) return (
      <span className="font-mono text-xs" style={{ color: waitingColor(waiting) }} title={`Sent to client ${fmtDM(reviewDate)}`}>Waiting {waiting} days</span>
    );
  }
  return <span className="font-mono text-xs" style={{ color: "#7b8a9a" }}>{fmtDM(reviewDate)}</span>;
}

// Target date with overdue / due-soon colouring (spec Projects §6).
export function TargetDateCell({ status, targetDate }: { status: string; targetDate: string | null }) {
  if (!targetDate) return <span className="font-mono text-xs" style={{ color: "#7b8a9a" }}>—</span>;
  const overdue = isOverdue(status, targetDate);
  if (overdue) {
    const d = overdueDays(targetDate)!;
    return <span className="font-mono text-xs" style={{ color: "#f87171" }}>{fmtDM(targetDate)} · Overdue {d} {d === 1 ? "day" : "days"}</span>;
  }
  const until = daysSince(targetDate); // negative = future
  const soon = until !== null && until < 0 && until >= -7;
  return <span className="font-mono text-xs" style={{ color: soon ? "#fbbf24" : "#7b8a9a" }}>{fmtDM(targetDate)}</span>;
}
