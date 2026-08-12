import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { StatusBadge, ProgressBar, Avatar } from "./ui";
import { STATUSES, STATUS_STYLES, fmtDM, healthColor } from "../lib/constants";
import type { Project, ProjectStatus } from "../lib/types";

// Multi-select status filter chips. `selected` is a Set of statuses; empty = show all.
export function StatusFilterChips({ selected, onToggle, onClear }: {
  selected: Set<string>; onToggle: (s: ProjectStatus) => void; onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={onClear}
        className="rounded-full px-3 py-1.5 text-xs font-medium font-body"
        style={selected.size === 0
          ? { background: "#e8795a", color: "#1a0d08", border: "1px solid #e8795a" }
          : { background: "#161f29", color: "#9fb0c0", border: "1px solid #25323f" }}>
        All
      </button>
      {STATUSES.map((s) => {
        const on = selected.has(s);
        const st = STATUS_STYLES[s];
        return (
          <button key={s} onClick={() => onToggle(s)}
            className="rounded-full px-3 py-1.5 text-xs font-medium font-body inline-flex items-center gap-1.5"
            style={on
              ? { background: st.bg, color: st.fg, border: `1px solid ${st.dot}` }
              : { background: "#161f29", color: "#9fb0c0", border: "1px solid #25323f" }}>
            <span className="rounded-full" style={{ width: 7, height: 7, background: st.dot }} />
            {s}
          </button>
        );
      })}
    </div>
  );
}

// Expandable project card for mobile. Collapsed: name, client, status, hours bar.
// Expanded: adds team, start/review dates, video minutes, and an Open button.
export function ProjectCardMobile({ project, clientName, logged, members, onOpen }: {
  project: Project;
  clientName: string;
  logged: number;
  members: { id: string; name: string }[];
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const p = project;
  const over = logged > p.estimated_hours;
  return (
    <div className="rounded-xl border" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <span className="rounded-full shrink-0 mt-1.5" style={{ width: 8, height: 8, background: p.color ?? "#64748b" }} />
            <div className="min-w-0">
              <div className="font-body font-medium leading-tight" style={{ color: "#e2e8f0" }}>{p.name}</div>
              <div className="font-body text-xs mt-0.5" style={{ color: "#7b8a9a" }}>{clientName}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge status={p.status} />
            {open ? <ChevronDown size={16} style={{ color: "#64748b" }} /> : <ChevronRight size={16} style={{ color: "#64748b" }} />}
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-3">
          <div className="flex-1"><ProgressBar current={logged} est={p.estimated_hours} /></div>
          <span className="font-mono text-xs shrink-0" style={{ color: over ? "#f87171" : "#9fb0c0" }}>{logged.toFixed(1)}/{p.estimated_hours}h</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-2.5" style={{ borderTop: "1px solid #141c25" }}>
          <Row label="Team">
            {members.length === 0 ? <span style={{ color: "#475569" }}>—</span> : (
              <div className="flex flex-wrap gap-1">
                {members.map((m) => <Avatar key={m.id} id={m.id} name={m.name} size={22} />)}
              </div>
            )}
          </Row>
          <Row label="Start date"><span className="font-mono">{fmtDM(p.start_date)}</span></Row>
          <Row label="Client review"><span className="font-mono" style={{ color: reviewLate(p) ? "#fcd34d" : undefined }}>{fmtDM(p.client_review_date)}</span></Row>
          <Row label="Video minutes"><span className="font-mono">{p.video_minutes ?? "—"}</span></Row>
          <Row label="Budget">
            <span className="font-mono" style={{ color: healthColor(logged, p.estimated_hours) }}>{logged.toFixed(1)} / {p.estimated_hours}h</span>
          </Row>
          <button onClick={onOpen} className="w-full mt-1 rounded-lg py-2 text-sm font-semibold font-body" style={{ background: "#e8795a", color: "#1a0d08" }}>Open project</button>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm font-body">
      <span style={{ color: "#7b8a9a" }}>{label}</span>
      <span style={{ color: "#dbe4ec" }}>{children}</span>
    </div>
  );
}

function reviewLate(p: Project) {
  return !!p.client_review_date && p.status !== "Closed" && new Date(p.client_review_date + "T00:00:00") < new Date(new Date().toDateString());
}
