"use client";
import { useEffect, useState } from "react";
import MockBadge from "./MockBadge";
import DevOnly from "@/components/DevOnly";

type W = { id: string; source: string; delivery: string; target: string; createdAt: string };

/** Talks to /api/mock/watches, which is backed by the SIMULATED in-memory store (resets on server restart). */
export default function AlertsClient() {
  const [sources, setSources] = useState<string[]>([]);
  const [list, setList] = useState<W[]>([]);
  const [source, setSource] = useState("");
  const [delivery, setDelivery] = useState<"email" | "webhook" | "both">("email");
  const [target, setTarget] = useState("");
  const [err, setErr] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  async function load() {
    try {
      const r = await fetch("/api/mock/watches");
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      setSources(j.sources); setList(j.watches); setSource((s) => s || j.sources[0]); setState("ready");
    } catch { setState("error"); }
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    try {
      const r = await fetch("/api/mock/watches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source, delivery, target }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error); return; }
      setTarget(""); load();
    } catch { setErr("Couldn’t reach the mock service. Check that the dev server is running, then try again."); }
  }
  async function del(id: string) { try { await fetch(`/api/mock/watches?id=${id}`, { method: "DELETE" }); } catch { setErr("Couldn’t delete: the mock service is unreachable."); } load(); }

  const input = "w-full rounded-control border border-[var(--control-border)] bg-surface px-3 py-2 text-[15px]";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={add} className="space-y-4 rounded-panel border border-border bg-surface p-6">
        <DevOnly><p className="text-[12px] text-muted"><MockBadge>simulated database</MockBadge> Stored in server memory; cleared on restart.</p></DevOnly>
        <div><label htmlFor="al-src" className="mb-1 block text-[14px] font-medium">Source to watch</label>
          <select id="al-src" className={input} value={source} onChange={(e) => setSource(e.target.value)} disabled={state !== "ready"}>{state === "ready" ? sources.map((s) => <option key={s}>{s}</option>) : <option>{state === "loading" ? "Loading sources…" : "Sources unavailable"}</option>}</select></div>
        <div><label htmlFor="al-del" className="mb-1 block text-[14px] font-medium">Delivery</label>
          <select id="al-del" className={input} value={delivery} onChange={(e) => setDelivery(e.target.value as typeof delivery)}><option value="email">Email</option><option value="webhook">Webhook</option><option value="both">Both</option></select></div>
        <div><label htmlFor="al-tg" className="mb-1 block text-[14px] font-medium">{delivery === "webhook" ? "Webhook URL" : "Email address"}</label>
          <input id="al-tg" className={input} value={target} onChange={(e) => setTarget(e.target.value)} placeholder={delivery === "webhook" ? "https://example.com/hooks/lexbharat" : "you@company.com"} /></div>
        <button className="btn btn-primary disabled:opacity-50" disabled={!source}>Create watch</button>
        <p className="min-h-5 text-[14px] text-error" aria-live="polite">{state === "error" ? "Couldn’t load the mock watch service." : err}</p>
        {state === "error" && <button type="button" onClick={() => { setState("loading"); load(); }} className="btn btn-secondary !px-4 !py-2 !text-[14px]">Retry</button>}
      </form>
      <div className="rounded-panel border border-border bg-surface p-6">
        <h3 className="text-[18px] font-semibold">Your watches</h3>
        {state === "loading" ? <p className="mt-3 text-[15px] text-muted">Loading…</p> : state === "error" ? <p className="mt-3 text-[15px] text-muted">Unavailable.</p> : list.length === 0 ? <p className="mt-3 text-[15px] text-muted">No watches yet.</p> : (
          <ul className="mt-3 divide-y divide-border">
            {list.map((w) => (
              <li key={w.id} className="flex items-start justify-between gap-3 py-3">
                <div><p className="font-medium">{w.source}</p><p className="text-[13px] text-muted">{w.delivery} → {w.target}</p><p className="font-mono text-[11px] text-muted">{w.id}</p></div>
                <button onClick={() => del(w.id)} className="px-2 py-1.5 text-[13px] text-error hover:underline">Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
