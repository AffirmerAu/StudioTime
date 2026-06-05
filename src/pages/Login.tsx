import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { PrimaryButton, Label, fieldCls, fieldStyle } from "../components/ui";

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    if (error) setError(error);
    setBusy(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 font-body" style={{ background: "#080c11" }}>
      <div className="w-full rounded-2xl border p-7" style={{ maxWidth: 380, background: "#0f151d", borderColor: "#1c2734" }}>
        <div className="flex items-center gap-2.5 mb-6">
          <img src="/favicon.svg" alt="StudioTime" width={30} height={30} className="rounded-lg" style={{ display: "block" }} />
          <span className="font-display text-lg" style={{ color: "#f1f5f9" }}>Studio<span style={{ color: "#e8795a" }}>Time</span></span>
        </div>
        <div className="space-y-4">
          <div>
            <Label>Email</Label>
            <input className={fieldCls} style={fieldStyle} value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }} autoComplete="email" />
          </div>
          <div>
            <Label>Password</Label>
            <input type="password" className={fieldCls} style={fieldStyle} value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }} autoComplete="current-password" />
          </div>
          {error && <div className="text-sm font-body" style={{ color: "#f87171" }}>{error}</div>}
          <PrimaryButton onClick={submit} className={`w-full justify-center ${busy ? "opacity-60 pointer-events-none" : ""}`}>
            {busy ? "Signing in…" : "Sign in"}
          </PrimaryButton>
        </div>
        <p className="mt-5 text-xs font-body" style={{ color: "#475569" }}>
          Accounts are created in the Supabase dashboard (Authentication → Users).
        </p>
      </div>
    </div>
  );
}
