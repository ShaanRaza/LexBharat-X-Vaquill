"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge, Notice, Panel } from "@/components/kit";
import { CONTRACT_TYPES, isContractType } from "@/lib/review/rules.mjs";
import type { ReviewSummaryRow } from "@/lib/review/store";
import DocStatus from "@/components/workspace/vault/DocStatus";
import UploadButton from "@/components/workspace/vault/UploadButton";
import { useVault } from "@/components/workspace/vault/useVault";
import { RISK_BADGE, STATUS_TEXT } from "./labels";

// The Review start page: pick a contract from the Vault (or add one), say what kind of contract it is and which side you are on, then start. Past reviews are listed below. Presentation only.
type Meta = { ready: boolean; reviews: ReviewSummaryRow[]; limits: { daily: number; weekly: number; maxSaved: number }; usage: { day: number; week: number }; error?: string };
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const FIELD = "mt-1 h-11 w-full rounded-input bg-surface px-3 text-ui-body ring-1 ring-control-border focus-visible:outline-2";

export default function ReviewHome() {
  const router = useRouter(), v = useVault();
  const [meta, setMeta] = useState<Meta | null>(null), [docId, setDocId] = useState(""), [type, setType] = useState(""), [side, setSide] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const load = useCallback(() => { fetch("/api/review", { cache: "no-store" }).then((r) => r.json()).then(setMeta).catch(() => setMeta({ ready: false, reviews: [], limits: { daily: 5, weekly: 20, maxSaved: 30 }, usage: { day: 0, week: 0 }, error: "Could not load your reviews." })); }, []);
  useEffect(() => { load(); }, [load]);
  const docs = v.state?.docs ?? [], ready = docs.filter((d) => d.status === "ready");
  const sides = isContractType(type) ? CONTRACT_TYPES[type].sides : [];
  async function start(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { const r = await fetch("/api/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ docId, contractType: type, side }) }), j = await r.json(); if (!r.ok) throw new Error(j.error || "Something went wrong."); router.push(`/workspace/review/${j.id}`); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  async function remove(id: string, name: string) { if (!window.confirm(`Delete the review of “${name}”? This cannot be undone.`)) return; await fetch(`/api/review/${id}`, { method: "DELETE" }).catch(() => null); load(); }
  const left = meta ? Math.max(0, meta.limits.daily - meta.usage.day) : null;
  return (
    <div className="mx-auto max-w-4xl pb-10">
      <Notice tone="warn" role="note" compact className="mt-2"><p><strong className="font-medium text-foreground">Testing phase:</strong> don&apos;t upload confidential client documents. Reviews are for a qualified lawyer to confirm and are not legal advice.</p></Notice>
      <h1 className="mt-6 text-ui-title font-semibold">Review a contract</h1>
      <p className="mt-2 text-ui-body text-secondary">Get a summary, a clause-by-clause risk reading, suggested wording, missing clauses and the Indian-law points that bear on the contract, each tied to a section we retrieved.</p>
      {meta && !meta.ready && <Notice tone="warn" role="status" className="mt-4"><p>Review is not set up on this server yet (it needs the Vault storage and a model key).</p></Notice>}

      <form onSubmit={start} className="mt-6">
        <Panel as="div" className="space-y-4">
          <div>
            <label htmlFor="rv-doc" className="text-ui-base font-medium">1. The contract</label>
            <div className="flex flex-wrap items-end gap-2">
              <select id="rv-doc" value={docId} onChange={(e) => setDocId(e.target.value)} className={`${FIELD} min-w-0 flex-1 basis-60`}>
                <option value="">{v.state ? (docs.length ? "Choose a document from your Vault…" : "Your Vault is empty. Add a contract →") : "Loading…"}</option>
                {docs.map((d) => <option key={d.id} value={d.id} disabled={d.status !== "ready"}>{d.name}{d.status === "processing" ? " (still processing…)" : d.status === "unreadable" ? " (can't read)" : ""}</option>)}
              </select>
              <div className="mt-1"><UploadButton onFiles={v.upload} label="Add a document" multiple={false} /></div>
            </div>
            {v.notes.map((n, i) => <p key={i} role={n.ok ? "status" : "alert"} className={`mt-2 text-ui-sm ${n.ok ? "text-secondary" : "text-quality-bad"}`}>{n.name}: {n.message}</p>)}
            {docs.some((d) => d.status === "processing") && <p className="mt-2 text-ui-sm text-muted">A document you added is being prepared. It appears here as soon as it is ready. {docs.filter((d) => d.status === "processing").map((d) => <span key={d.id}><DocStatus doc={d} /> </span>)}</p>}
            {ready.length === 0 && docs.length > 0 && !docs.some((d) => d.status === "processing") && <p className="mt-2 text-ui-sm text-quality-bad">None of your documents can be reviewed. <Link href="/workspace/vault" className="text-primary hover:underline">See the Vault</Link></p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="rv-type" className="text-ui-base font-medium">2. Type of contract</label>
              <select id="rv-type" value={type} onChange={(e) => { setType(e.target.value); setSide(""); }} className={FIELD}><option value="">Choose…</option>{Object.entries(CONTRACT_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select></div>
            <div><label htmlFor="rv-side" className="text-ui-base font-medium">3. Your side</label>
              <select id="rv-side" value={side} onChange={(e) => setSide(e.target.value)} disabled={!sides.length} className={`${FIELD} disabled:opacity-60`}><option value="">{sides.length ? "Choose…" : "Choose the type first"}</option>{sides.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          {err && <Notice tone="bad" role="alert" compact><p>{err}</p></Notice>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy || !docId || !type || !side || (meta ? !meta.ready : true)} className="h-11 rounded-button bg-primary px-5 text-ui-base font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50">{busy ? "Starting…" : "Start review"}</button>
            <p className="text-ui-sm text-muted">{meta ? `${meta.limits.daily} reviews a day, ${meta.limits.weekly} a week; ${left} left today.` : ""} A review takes a few minutes on the free plan.</p>
          </div>
        </Panel>
      </form>

      <section aria-labelledby="past" className="mt-8">
        <h2 id="past" className="text-ui-lead font-semibold">Your reviews</h2>
        <Panel as="div" className="mt-3 px-card py-3">
          {meta && meta.reviews.length === 0 && <p className="py-3 text-center text-ui-base text-secondary">No reviews on this browser yet.</p>}
          {!meta && <p className="py-3 text-ui-base text-muted">Loading…</p>}
          {!!meta?.reviews.length && (
            <ul className="divide-y divide-border/60">
              {meta.reviews.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <Link href={`/workspace/review/${r.id}`} className="min-w-0 flex-1 basis-48 hover:text-primary"><span className="block truncate text-ui-base">{r.docName}</span><span className="block text-ui-sm text-muted">{CONTRACT_TYPES[r.contractType as keyof typeof CONTRACT_TYPES]?.label ?? r.contractType} · {r.side} · {when(r.createdAt)}</span></Link>
                  {r.risk ? <Badge tone={RISK_BADGE[r.risk].tone}>{RISK_BADGE[r.risk].text}</Badge> : <Badge>{STATUS_TEXT[r.status]}</Badge>}
                  <button type="button" onClick={() => remove(r.id, r.docName)} aria-label={`Delete the review of ${r.docName}`} className="rounded-chip px-2 py-1 text-ui-sm text-muted hover:bg-accent focus-visible:outline-2">Delete</button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-ui-sm text-muted">Saved on this browser only.</p>
        </Panel>
      </section>
    </div>
  );
}
