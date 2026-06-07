import { useRef, useState } from "react";
import { Paperclip, Link2, FileText, Trash2, Upload, Send, ExternalLink, Loader2 } from "lucide-react";
import { useProfiles, useProjectNotes, useNoteMutations, useProjectAttachments, useAttachmentMutations } from "../data/hooks";
import { Avatar, PrimaryButton, GhostButton, Label, fieldCls, fieldStyle } from "./ui";
import type { ProjectAttachment } from "../lib/types";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const prettySize = (n: number | null) => {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

export function ProjectCollab({ projectId, currentUserId, isManager }: {
  projectId: string; currentUserId: string; isManager: boolean;
}) {
  const { data: profiles = [] } = useProfiles();
  const nameOf = (id: string | null) => profiles.find((p) => p.id === id)?.full_name ?? "Unknown";
  const canDelete = (ownerId: string | null) => isManager || ownerId === currentUserId;

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <NotesPanel projectId={projectId} currentUserId={currentUserId} nameOf={nameOf} canDelete={canDelete} />
      <AttachmentsPanel projectId={projectId} currentUserId={currentUserId} nameOf={nameOf} canDelete={canDelete} />
    </div>
  );
}

function NotesPanel({ projectId, currentUserId, nameOf, canDelete }: {
  projectId: string; currentUserId: string; nameOf: (id: string | null) => string; canDelete: (id: string | null) => boolean;
}) {
  const { data: notes = [] } = useProjectNotes(projectId);
  const { add, remove } = useNoteMutations(projectId);
  const [body, setBody] = useState("");
  const submit = () => {
    const text = body.trim();
    if (!text) return;
    add.mutate({ body: text, authorId: currentUserId }, { onSuccess: () => setBody("") });
  };
  return (
    <div className="rounded-xl border" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
      <div className="px-5 py-3 font-display text-base" style={{ color: "#e2e8f0", borderBottom: "1px solid #1c2734" }}>
        Notes <span className="font-body text-sm" style={{ color: "#64748b" }}>({notes.length})</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note…"
            className={fieldCls} style={{ ...fieldStyle, resize: "vertical" }} />
        </div>
        <div className="flex justify-end">
          <PrimaryButton onClick={submit} className={body.trim() ? "" : "opacity-50 pointer-events-none"}><Send size={14} /> Post note</PrimaryButton>
        </div>
        <div className="space-y-2.5 pt-1">
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg p-3" style={{ background: "#11181f", border: "1px solid #1c2734" }}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar id={n.author_id ?? ""} name={nameOf(n.author_id)} size={20} />
                  <span className="font-body text-xs truncate" style={{ color: "#9fb0c0" }}>{nameOf(n.author_id)}</span>
                  <span className="font-mono" style={{ fontSize: 10, color: "#475569" }}>{when(n.created_at)}</span>
                </div>
                {canDelete(n.author_id) && (
                  <button title="Delete note" onClick={() => { if (confirm("Delete this note?")) remove.mutate(n.id); }} className="rounded-md p-1 shrink-0" style={{ color: "#64748b" }}><Trash2 size={13} /></button>
                )}
              </div>
              <div className="font-body text-sm whitespace-pre-wrap" style={{ color: "#dbe4ec" }}>{n.body}</div>
            </div>
          ))}
          {notes.length === 0 && <div className="font-body text-sm py-3 text-center" style={{ color: "#475569" }}>No notes yet.</div>}
        </div>
      </div>
    </div>
  );
}

function AttachmentsPanel({ projectId, currentUserId, nameOf, canDelete }: {
  projectId: string; currentUserId: string; nameOf: (id: string | null) => string; canDelete: (id: string | null) => boolean;
}) {
  const { data: attachments = [] } = useProjectAttachments(projectId);
  const { uploadFile, addLink, remove } = useAttachmentMutations(projectId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [uploading, setUploading] = useState(false);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      await new Promise<void>((res) => uploadFile.mutate({ file, userId: currentUserId }, { onSettled: () => res() }));
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  };
  const submitLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    addLink.mutate({ url: withProto, name: linkName.trim(), userId: currentUserId }, {
      onSuccess: () => { setLinkUrl(""); setLinkName(""); setShowLink(false); },
    });
  };

  const images = attachments.filter((a) => a.kind === "file" && (a.mime ?? "").startsWith("image/"));
  const others = attachments.filter((a) => !(a.kind === "file" && (a.mime ?? "").startsWith("image/")));

  return (
    <div className="rounded-xl border" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid #1c2734" }}>
        <span className="font-display text-base" style={{ color: "#e2e8f0" }}>Files & links <span className="font-body text-sm" style={{ color: "#64748b" }}>({attachments.length})</span></span>
        <div className="flex items-center gap-2">
          <GhostButton onClick={() => setShowLink((s) => !s)}><Link2 size={14} /> Link</GhostButton>
          <PrimaryButton onClick={() => fileInput.current?.click()} className={uploading ? "opacity-60 pointer-events-none" : ""}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload
          </PrimaryButton>
          <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        </div>
      </div>
      <div className="p-4 space-y-3">
        {showLink && (
          <div className="rounded-lg p-3 space-y-2" style={{ background: "#11181f", border: "1px solid #1c2734" }}>
            <div><Label>URL</Label><input className={fieldCls} style={fieldStyle} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" /></div>
            <div><Label>Label (optional)</Label><input className={fieldCls} style={fieldStyle} value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="e.g. Brief in Google Docs" /></div>
            <div className="flex justify-end gap-2"><GhostButton onClick={() => setShowLink(false)}>Cancel</GhostButton><PrimaryButton onClick={submitLink} className={linkUrl.trim() ? "" : "opacity-50 pointer-events-none"}>Add link</PrimaryButton></div>
          </div>
        )}

        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((a) => (
              <div key={a.id} className="relative group rounded-lg overflow-hidden" style={{ border: "1px solid #1c2734", aspectRatio: "1 / 1", background: "#11181f" }}>
                <a href={a.signedUrl ?? undefined} target="_blank" rel="noreferrer">
                  {a.signedUrl ? <img src={a.signedUrl} alt={a.name} className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
                </a>
                {canDelete(a.uploaded_by) && (
                  <button title="Delete" onClick={() => { if (confirm(`Delete ${a.name}?`)) remove.mutate(a); }}
                    className="absolute top-1 right-1 rounded-md p-1" style={{ background: "rgba(8,12,17,0.7)", color: "#f87171" }}><Trash2 size={12} /></button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          {others.map((a) => (
            <div key={a.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ background: "#11181f", border: "1px solid #1c2734" }}>
              {a.kind === "link" ? <Link2 size={15} style={{ color: "#5fb9c9", flexShrink: 0 }} /> : <FileText size={15} style={{ color: "#9b8df0", flexShrink: 0 }} />}
              <a href={(a.kind === "link" ? a.url : a.signedUrl) ?? undefined} target="_blank" rel="noreferrer" className="flex-1 min-w-0">
                <div className="font-body text-sm truncate hover:underline" style={{ color: "#e2e8f0" }}>{a.name}</div>
                <div className="font-body" style={{ fontSize: 10, color: "#64748b" }}>{a.kind === "link" ? "Link" : prettySize(a.size)} · {nameOf(a.uploaded_by)} · {when(a.created_at)}</div>
              </a>
              <a href={(a.kind === "link" ? a.url : a.signedUrl) ?? undefined} target="_blank" rel="noreferrer" title="Open" className="rounded-md p-1.5 shrink-0" style={{ color: "#7b8a9a" }}><ExternalLink size={14} /></a>
              {canDelete(a.uploaded_by) && (
                <button title="Delete" onClick={() => { if (confirm(`Delete ${a.name}?`)) remove.mutate(a); }} className="rounded-md p-1.5 shrink-0" style={{ color: "#64748b" }}><Trash2 size={14} /></button>
              )}
            </div>
          ))}
        </div>

        {attachments.length === 0 && <div className="font-body text-sm py-3 text-center" style={{ color: "#475569" }}>No files or links yet.</div>}
      </div>
    </div>
  );
}
