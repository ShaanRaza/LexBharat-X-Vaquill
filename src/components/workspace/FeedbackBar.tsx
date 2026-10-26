"use client";
import { useEffect, useState } from "react";
import { REASONS, MAX_COMMENT } from "@/lib/insights/rules.mjs";

// 👍/👎 under an answer, draft or review. Presentation and fetching only (rules in src/lib/insights, saving in src/app/api/feedback). Colours, sizes and radii come from the shared tokens.
type Feature = "chat" | "draft" | "review";
type Vote = "up" | "down";
type Mine = { vote: Vote; reasons: string[]; comment: string };

// one request for all the bars that mount together (a chat with many answers)
const waiting = new Map<string, { ids: Set<string>; resolvers: Map<string, (m: Mine | null) => void> }>();
let timer: ReturnType<typeof setTimeout> | null = null;
function loadMine(feature: Feature, id: string): Promise<Mine | null> {
  return new Promise((resolve) => {
    const w = waiting.get(feature) ?? waiting.set(feature, { ids: new Set(), resolvers: new Map() }).get(feature)!;
    w.ids.add(id); w.resolvers.set(id, resolve);
    timer ??= setTimeout(() => {
      timer = null;
      for (const [f, b] of [...waiting]) {
        waiting.delete(f);
        fetch(`/api/feedback?feature=${f}&ids=${[...b.ids].join(",")}`, { cache: "no-store" }).then((r) => r.json()).then((j) => b.resolvers.forEach((res, i) => res(j.votes?.[i] ?? null))).catch(() => b.resolvers.forEach((res) => res(null)));
      }
    }, 40);
  });
}

const btn = "inline-flex size-9 items-center justify-center rounded-control text-ui-lead ring-1 ring-control-border hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary";

export default function FeedbackBar({ feature, itemId, className = "" }: { feature: Feature; itemId: string; className?: string }) {
  const [vote, setVote] = useState<Vote | null>(null), [reasons, setReasons] = useState<string[]>([]), [comment, setComment] = useState("");
  const [sent, setSent] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [editing, setEditing] = useState(false);
  useEffect(() => {
    let alive = true;
    setVote(null); setReasons([]); setComment(""); setSent(false); setEditing(false); setErr("");
    loadMine(feature, itemId).then((m) => { if (alive && m) { setVote(m.vote); setReasons(m.reasons); setComment(m.comment); setSent(true); } });
    return () => { alive = false; };
  }, [feature, itemId]);

  async function save(v: Vote, r: string[], c: string) {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ feature, itemId, vote: v, reasons: r, comment: c }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Feedback could not be saved.");
      setVote(v); setSent(true); return true;
    } catch (e) { setErr((e as Error).message); return false; } finally { setBusy(false); }
  }
  const pick = async (v: Vote) => {
    if (busy || (v === vote && !editing)) { if (v === "down") setEditing((x) => !x); return; }
    if (v === "up") { setReasons([]); setComment(""); setEditing(false); await save("up", [], ""); }
    else { if (await save("down", reasons, comment)) setEditing(true); }
  };
  const toggle = (r: string) => setReasons((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]));
  const showForm = vote === "down" && editing;

  return (
    <div className={`text-ui-sm ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-secondary" id={`fb-${feature}-${itemId}`}>Was this helpful?</span>
        <span role="group" aria-labelledby={`fb-${feature}-${itemId}`} className="inline-flex gap-1.5">
          <button type="button" onClick={() => pick("up")} aria-pressed={vote === "up"} aria-label="Helpful" title="Helpful" disabled={busy} className={`${btn} ${vote === "up" ? "bg-accent ring-primary" : ""}`}><span aria-hidden>👍</span></button>
          <button type="button" onClick={() => pick("down")} aria-pressed={vote === "down"} aria-label="Not helpful" title="Not helpful" disabled={busy} className={`${btn} ${vote === "down" ? "bg-accent ring-primary" : ""}`}><span aria-hidden>👎</span></button>
        </span>
        <span role="status" className="text-secondary">{busy ? "Saving…" : sent && !showForm ? "Thanks" : ""}</span>
        {err && <span role="alert" className="text-error">{err}</span>}
      </div>
      {showForm && (
        <form className="mt-2 max-w-xl space-y-2" onSubmit={async (e) => { e.preventDefault(); if (await save("down", reasons, comment)) setEditing(false); }}>
          <fieldset>
            <legend className="text-secondary">What went wrong? (optional)</legend>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {REASONS.map((r: string) => <button type="button" key={r} aria-pressed={reasons.includes(r)} onClick={() => toggle(r)} className={`min-h-9 rounded-chip px-3 text-ui-sm ring-1 ring-control-border hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary ${reasons.includes(r) ? "bg-accent font-medium ring-primary" : "bg-surface"}`}>{r}</button>)}
            </div>
          </fieldset>
          <label className="block"><span className="sr-only">Comment (optional)</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={MAX_COMMENT} rows={2} placeholder="Tell us more (optional). Please don't include confidential details." className="w-full rounded-input bg-surface px-3 py-2 text-ui-base text-foreground ring-1 ring-control-border focus-visible:outline-2" />
          </label>
          <div className="flex gap-2"><button type="submit" disabled={busy} className="min-h-9 rounded-button bg-primary px-4 text-ui-sm font-medium text-on-primary disabled:opacity-50">Send</button><button type="button" onClick={() => setEditing(false)} className="min-h-9 rounded-button px-3 text-ui-sm ring-1 ring-control-border hover:bg-accent">Not now</button></div>
        </form>
      )}
    </div>
  );
}
