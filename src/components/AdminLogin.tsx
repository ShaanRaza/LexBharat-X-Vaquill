"use client";
import { useState } from "react";
import { Notice } from "@/components/kit";

// The admin password form. Presentation and fetching only; the check happens in /api/admin/login.
export default function AdminLogin() {
  const [pw, setPw] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { window.location.reload(); return; }
      setErr(j.error || "Something went wrong. Try again."); setPw("");
    } catch { setErr("Could not reach the server. Try again."); }
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <label htmlFor="admin-pw" className="block text-ui-base font-medium">Admin password</label>
      <input id="admin-pw" type="password" autoComplete="off" autoFocus required value={pw} onChange={(e) => setPw(e.target.value)} className="h-11 w-full rounded-panel bg-surface px-3 text-ui-body text-foreground ring-1 ring-border focus-visible:outline-2" />
      {err && <Notice tone="bad" role="alert" compact><p>{err}</p></Notice>}
      <button type="submit" disabled={busy || !pw} className="h-11 w-full rounded-panel bg-primary px-4 text-ui-base font-medium text-on-primary disabled:opacity-50">{busy ? "Checking…" : "Open insights"}</button>
    </form>
  );
}
