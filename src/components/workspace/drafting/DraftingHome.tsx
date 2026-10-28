"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Notice, Panel } from "@/components/kit";
import { useDraftingMeta } from "./useDraftingMeta";

// The Drafting start page: describe what you need (the model picks the closest template and says why), or choose a template; your saved drafts are listed below.
type Pick = { templateId: string; why: string; fit: "good" | "partial" | "poor" };
const FIT = { good: { tone: "complete", text: "Good fit" }, partial: { tone: "warn", text: "Partial fit" }, poor: { tone: "bad", text: "Poor fit" } } as const;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function DraftingHome() {
  const { meta, failed, reload } = useDraftingMeta();
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [pick, setPick] = useState<Pick | null>(null), [err, setErr] = useState("");
  async function find(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(""); setPick(null);
    try { const r = await fetch("/api/drafting/pick", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) }), j = await r.json(); if (!r.ok) throw new Error(j.error || "Something went wrong."); setPick(j); }
    catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }
  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete the draft “${title}”? This cannot be undone.`)) return;
    await fetch(`/api/drafting/${id}`, { method: "DELETE" }).catch(() => null); reload(); window.dispatchEvent(new Event("lb-drafts-changed"));
  }
  const byId = new Map((meta?.templates ?? []).map((t) => [t.id, t]));
  return (
    <div className="mx-auto max-w-4xl pb-10">
      <Notice tone="warn" role="note" compact className="mt-2"><p><strong className="font-medium text-foreground">Drafts are for review by a qualified lawyer and are not legal advice.</strong></p></Notice>
      <h1 className="mt-6 text-ui-title font-semibold">Drafting</h1>
      <p className="mt-2 text-ui-body text-secondary">Choose a template, fill in the details, and get a first draft grounded in the Act sections it relies on. Anything you leave out becomes a highlighted placeholder, never an invented fact.</p>
      {meta && !meta.ready && <Notice tone="warn" role="status" className="mt-4"><p>Drafting is not set up on this server yet (it needs the database and a model key).</p></Notice>}
      {failed && <Notice tone="bad" role="alert" className="mt-4"><p>Could not load the templates. Reload the page.</p></Notice>}

      <section aria-labelledby="describe" className="mt-8">
        <h2 id="describe" className="text-ui-lead font-semibold">Describe what you need</h2>
        <form onSubmit={find} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="need" className="sr-only">What do you need to draft?</label>
          <input id="need" value={text} onChange={(e) => setText(e.target.value)} maxLength={600} placeholder="For example: my tenant's cheque bounced and I want to send a notice" className="h-11 flex-1 rounded-input bg-surface px-3 text-ui-body ring-1 ring-control-border focus-visible:outline-2" />
          <button type="submit" disabled={busy || text.trim().length < 8} className="h-11 rounded-button bg-primary px-5 text-ui-base font-medium text-white disabled:opacity-50">{busy ? "Looking…" : "Find a template"}</button>
        </form>
        {err && <Notice tone="bad" role="alert" compact className="mt-2"><p>{err}</p></Notice>}
        {pick && byId.get(pick.templateId) && (
          <Panel as="div" className="mt-3">
            <p className="flex flex-wrap items-center gap-2 text-ui-base"><strong className="font-medium">{byId.get(pick.templateId)!.title}</strong><Badge tone={FIT[pick.fit].tone}>{FIT[pick.fit].text}</Badge></p>
            <p className="mt-1 text-ui-base text-secondary">{pick.why}</p>
            <Link href={`/work/drafts/new/${pick.templateId}`} className="mt-3 inline-flex min-h-10 items-center rounded-button bg-primary px-4 text-ui-base font-medium text-white hover:bg-primary-hover">Use this template</Link>
          </Panel>
        )}
      </section>

      <section aria-labelledby="templates" className="mt-8">
        <h2 id="templates" className="text-ui-lead font-semibold">Templates</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {(meta?.templates ?? []).map((t) => (
            <li key={t.id}><Link href={`/work/drafts/new/${t.id}`} className="block h-full rounded-card bg-surface p-card shadow-sm ring-1 ring-control-border/60 transition-colors hover:bg-accent/50 focus-visible:outline-2">
              <span className="block text-ui-body font-medium">{t.title}</span>
              <span className="mt-1 block text-ui-base text-secondary">{t.description}</span>
            </Link></li>
          ))}
          {!meta && !failed && [0, 1, 2, 3].map((i) => <li key={i} className="console-skel h-28 rounded-card bg-accent" aria-hidden />)}
        </ul>
      </section>

      <section aria-labelledby="mine" className="mt-8">
        <h2 id="mine" className="text-ui-lead font-semibold">Your drafts</h2>
        <Panel as="div" className="mt-3 px-card py-3">
          {meta && meta.drafts.length === 0 && <p className="py-3 text-center text-ui-base text-secondary">No drafts on this browser yet. Pick a template above to make one.</p>}
          {!!meta?.drafts.length && (
            <ul className="divide-y divide-border/60">
              {meta.drafts.map((d) => (
                <li key={d.id} className="flex items-center gap-2 py-2.5">
                  <Link href={`/work/drafts/${d.id}`} className="flex min-w-0 flex-1 items-baseline justify-between gap-3 hover:text-primary"><span className="min-w-0 truncate text-ui-base">{d.title}</span><span className="shrink-0 text-ui-sm text-muted">{when(d.updatedAt)}</span></Link>
                  <button type="button" onClick={() => remove(d.id, d.title)} aria-label={`Delete draft: ${d.title}`} className="rounded-chip px-2 py-1 text-ui-sm text-muted hover:bg-accent">Delete</button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-ui-sm text-muted">Saved on this browser only. {meta ? `${meta.limits.daily} drafts a day, ${meta.limits.weekly} a week; ${Math.max(0, meta.limits.daily - meta.usage.day)} left today.` : ""}</p>
        </Panel>
      </section>
    </div>
  );
}
