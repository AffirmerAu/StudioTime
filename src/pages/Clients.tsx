import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Archive } from "lucide-react";
import { useClients, useProjects, useClientMutations } from "../data/hooks";
import { PrimaryButton, GhostButton, Modal, Label, fieldCls, fieldStyle, Spinner } from "../components/ui";
import type { Client } from "../lib/types";

export function Clients() {
  const nav = useNavigate();
  const { data: clients = [], isLoading } = useClients();
  const { data: projects = [] } = useProjects();
  const { setArchived } = useClientMutations();
  const [modal, setModal] = useState<{ mode: "add" | "edit"; client: Client | null } | null>(null);

  const projCount = (cid: string) => projects.filter((p) => p.client_id === cid && !p.archived).length;
  if (isLoading) return <Spinner label="Loading clients…" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PrimaryButton onClick={() => setModal({ mode: "add", client: null })}><Plus size={16} /> Add Client</PrimaryButton>
      </div>
      <div className="rounded-xl border overflow-hidden" style={{ background: "#0f151d", borderColor: "#1c2734" }}>
        <table className="w-full text-sm font-body">
          <thead>
            <tr className="text-left" style={{ color: "#7b8a9a" }}>
              {["Client", "Contact", "Email", "Phone", "Projects", ""].map((h, i) => (
                <th key={i} className="px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ borderBottom: "1px solid #1c2734" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.filter((c) => !c.archived).map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #141c25" }}>
                <td className="px-4 py-3">
                  <button onClick={() => nav(`/projects?client=${c.id}`)} className="font-medium hover:underline" style={{ color: "#e2e8f0" }}>{c.name}</button>
                </td>
                <td className="px-4 py-3" style={{ color: "#9fb0c0" }}>{c.contact_person || "—"}</td>
                <td className="px-4 py-3" style={{ color: "#9fb0c0" }}>{c.email || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: "#9fb0c0" }}>{c.phone || "—"}</td>
                <td className="px-4 py-3 font-mono" style={{ color: "#e2e8f0" }}>{projCount(c.id)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button title="Edit" onClick={() => setModal({ mode: "edit", client: c })} className="rounded-md p-1.5" style={{ color: "#7b8a9a" }}><Pencil size={15} /></button>
                    <button title="Archive" onClick={() => setArchived.mutate({ id: c.id, archived: true })} className="rounded-md p-1.5" style={{ color: "#7b8a9a" }}><Archive size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {clients.filter((c) => !c.archived).length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center font-body" style={{ color: "#475569" }}>No clients yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && <ClientModal mode={modal.mode} client={modal.client} onClose={() => setModal(null)} />}
    </div>
  );
}

function ClientModal({ mode, client, onClose }: { mode: "add" | "edit"; client: Client | null; onClose: () => void }) {
  const { create, update } = useClientMutations();
  const [form, setForm] = useState({
    name: client?.name ?? "", contact_person: client?.contact_person ?? "",
    email: client?.email ?? "", phone: client?.phone ?? "", notes: client?.notes ?? "",
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    if (!form.name.trim()) return;
    if (mode === "add") create.mutate(form, { onSuccess: onClose });
    else update.mutate({ id: client!.id, patch: form }, { onSuccess: onClose });
  };
  return (
    <Modal title={mode === "add" ? "New Client" : "Edit Client"} onClose={onClose}>
      <div className="space-y-4">
        <div><Label>Client Name *</Label><input className={fieldCls} style={fieldStyle} value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div><Label>Contact Person</Label><input className={fieldCls} style={fieldStyle} value={form.contact_person ?? ""} onChange={(e) => set("contact_person", e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Email</Label><input className={fieldCls} style={fieldStyle} value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
          <div><Label>Phone</Label><input className={fieldCls} style={fieldStyle} value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></div>
        </div>
        <div><Label>Notes</Label><textarea rows={2} className={fieldCls} style={{ ...fieldStyle, resize: "vertical" }} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={submit} className={form.name.trim() ? "" : "opacity-50 pointer-events-none"}>{mode === "add" ? "Create" : "Save"}</PrimaryButton>
      </div>
    </Modal>
  );
}
