"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Notice } from "@/components/kit";
import { fieldClass } from "@/components/kit/controls";

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
        className={`${fieldClass} h-11`} />
      {err && <Notice tone="bad" role="alert" compact><p>{err}</p></Notice>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy || !pw}>{busy ? "Checking…" : "Continue"}</Button>
    </form>
  );
}
