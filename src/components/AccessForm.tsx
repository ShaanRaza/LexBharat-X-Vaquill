"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Notice } from "@/components/kit";

// Password form. Presentation and fetching only; the check happens in /api/access/login. Error text never hints at the password.
export default function AccessForm() {
  const next = useSearchParams().get("next") ?? "/";
  const [pw, setPw] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await fetch("/api/access/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw, next }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { window.location.assign(j.next || "/"); return; }
      setErr(j.error || "Something went wrong. Try again."); setPw("");
    } catch { setErr("Could not reach the server. Try again."); }
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <label htmlFor="access-pw" className="block text-ui-base font-medium">Access password</label>
      <input id="access-pw" type="password" autoComplete="current-password" autoFocus required value={pw} onChange={(e) => setPw(e.target.value)}
        className="h-11 w-full rounded-input bg-surface px-3 text-ui-body text-foreground ring-1 ring-control-border focus-visible:outline-2" />
      {err && <Notice tone="bad" role="alert" compact><p>{err}</p></Notice>}
      <button type="submit" disabled={busy || !pw} className="h-11 w-full rounded-panel bg-primary px-4 text-ui-base font-medium text-white disabled:opacity-50">{busy ? "Checking…" : "Continue"}</button>
    </form>
  );
}
