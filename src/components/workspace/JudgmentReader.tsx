"use client";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildSegments, findMatches, leadingNumber, paragraphRequest } from "@/lib/judgments/readerSegments.mjs";

// The judgment text as a reader: the first paragraphs, then the rest on request, loaded in small steps so a phone never freezes; search inside the judgment that jumps to and highlights matches;
// paragraph numbers where the text has them; a floating "Back to top". All text is real DOM text once shown, so the browser's own Find, copy and print work on it.
// Presentation only (colours, sizes, radii from the tokens). The text and Act-section links are prepared on the server (JudgmentFullText.tsx); the pure helpers are src/lib/judgments/readerSegments.mjs.
export type ReaderPara = { chunk: number; first: boolean; page: number | null; indic: boolean; t: string; m: { start: number; end: number; href: string | null; title: string }[] };
const INITIAL = 20, STEP = 25, MAX_MATCHES = 2000;

const Para = memo(function Para({ p, hits, activeStart, num, numId }: { p: ReaderPara; hits: { start: number; end: number }[]; activeStart: number; num: number | null; numId: boolean }) {
  const segs = useMemo(() => buildSegments(p.t, p.m, hits, activeStart), [p.t, p.m, hits, activeStart]);
  return (
    <div id={p.first ? `passage-${p.chunk}` : undefined} className={`scroll-mt-24 ${p.indic ? "rounded-control border-l-2 border-quality-warn pl-3" : ""}`}>
      {p.first && (p.page || p.indic) && <p className="mb-1 select-none text-ui-xs text-muted">{p.page ? <span title="Page of the report where this passage starts">Page {p.page}</span> : null}{p.indic ? <span className="ml-2 text-quality-warn">Contains another script</span> : null}</p>}
      {num !== null && <a id={numId ? `para-${num}` : undefined} href={`#para-${num}`} className="mb-0.5 inline-block select-none scroll-mt-24 text-ui-xs text-muted hover:text-primary" title="Paragraph number in the judgment (link to it)">¶ {num}</a>}
      <p className="whitespace-pre-line text-ui-body leading-relaxed">
        {segs.map((s, i) => {
          const inner = s.hit ? <mark data-hit="1" {...(s.active ? { "data-active": "1" } : {})} className={`rounded-control px-0.5 text-foreground ${s.active ? "bg-primary/40 ring-1 ring-primary" : "bg-primary/15"}`}>{s.text}</mark> : s.text;
          return s.href ? <Link key={i} href={s.href} title={s.title} className="rounded-chip text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-primary">{inner}</Link> : <span key={i}>{inner}</span>;
        })}
      </p>
    </div>
  );
});

export default function JudgmentReader({ paragraphs }: { paragraphs: ReaderPara[] }) {
  const n = paragraphs.length;
  const [shown, setShown] = useState(Math.min(INITIAL, n)), [target, setTarget] = useState(Math.min(INITIAL, n));
  const [q, setQ] = useState(""), [dq, setDq] = useState(""), [active, setActive] = useState(0), [note, setNote] = useState("");
  const [top, setTop] = useState(false);
  const pending = useRef<string | null>(null), lastScrolled = useRef("");
  const expandTo = useCallback((count: number) => setTarget((t) => Math.max(t, Math.min(n, count))), [n]);

  // paragraph numbers only where the text has them; the first paragraph carrying a number is the link target
  const nums = useMemo(() => { const seen = new Set<number>(); return paragraphs.map((p) => { const v = leadingNumber(p.t); const first = v !== null && !seen.has(v); if (v !== null) seen.add(v); return { v, first }; }); }, [paragraphs]);

  // load the rest in small steps (never one big render)
  useEffect(() => {
    if (shown >= target) return;
    const id = window.setTimeout(() => setShown((s) => Math.min(target, s + STEP)), 25);
    return () => window.clearTimeout(id);
  }, [shown, target]);

  // jump to a link target once it exists in the page
  useEffect(() => {
    if (!pending.current) return;
    const el = document.getElementById(pending.current);
    if (el) { el.scrollIntoView({ block: "start" }); pending.current = null; }
  }, [shown]);
  const jumpTo = useCallback((id: string) => {
    const m = /^passage-(\d+)$/.exec(id), k = /^para-(\d+)$/.exec(id);
    const idx = m ? paragraphs.findIndex((p) => p.first && p.chunk === Number(m[1])) : k ? nums.findIndex((x) => x.first && x.v === Number(k[1])) : -1;
    if (idx < 0) return false;
    pending.current = id; expandTo(idx + 8);
    if (document.getElementById(id)) { document.getElementById(id)!.scrollIntoView({ block: "start" }); pending.current = null; }
    return true;
  }, [expandTo, nums, paragraphs]);
  useEffect(() => { const go = () => { const h = window.location.hash.slice(1); if (h) jumpTo(h); }; go(); window.addEventListener("hashchange", go); return () => window.removeEventListener("hashchange", go); }, [jumpTo]);

  useEffect(() => { const t = window.setTimeout(() => setDq(q), 250); return () => window.clearTimeout(t); }, [q]);
  const para = paragraphRequest(dq);
  const found = useMemo(() => {
    const out: { p: number; start: number; end: number }[] = [];
    if (para !== null) return out;
    for (let i = 0; i < paragraphs.length && out.length < MAX_MATCHES; i++) for (const m of findMatches(paragraphs[i].t, dq)) { out.push({ p: i, ...m }); if (out.length >= MAX_MATCHES) break; }
    return out;
  }, [paragraphs, dq, para]);
  const byPara = useMemo(() => { const m = new Map<number, { start: number; end: number }[]>(); for (const f of found) (m.get(f.p) ?? m.set(f.p, []).get(f.p)!).push({ start: f.start, end: f.end }); return m; }, [found]);
  useEffect(() => { setActive(0); lastScrolled.current = ""; setNote(""); if (para !== null) { setNote(jumpTo(`para-${para}`) ? `Paragraph ${para}` : `This judgment has no paragraph numbered ${para}.`); } }, [dq, para, jumpTo]);
  const cur = found[Math.min(active, found.length - 1)];
  useEffect(() => { if (cur && cur.p >= shown) expandTo(cur.p + 4); }, [cur, shown, expandTo]);
  useEffect(() => {   // bring the selected match into view once its paragraph is on the page
    if (!cur) return;
    const key = `${dq}|${active}`; if (lastScrolled.current === key) return;
    const el = document.querySelector<HTMLElement>('mark[data-active="1"]');
    if (el) { lastScrolled.current = key; el.scrollIntoView({ block: "center" }); }
  }, [cur, active, shown, dq]);

  useEffect(() => { const on = () => setTop(window.scrollY > 800); on(); window.addEventListener("scroll", on, { passive: true }); return () => window.removeEventListener("scroll", on); }, []);
  const step = (d: number) => setActive((a) => (found.length ? (a + d + found.length) % found.length : 0));
  const loading = shown < target, collapsed = shown < n && !loading;

  return (
    <div>
      <div role="search" className="print:hidden">
        <label htmlFor="judg-q" className="text-ui-sm font-medium text-secondary">Search within this judgment</label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input id="judg-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="A word or phrase, or “para 12”" autoComplete="off"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); step(e.shiftKey ? -1 : 1); } }}
            className="h-10 min-w-0 flex-1 rounded-field bg-background px-3 text-ui-body ring-1 ring-border focus:outline-2 focus:outline-primary" />
          <button type="button" onClick={() => step(-1)} disabled={found.length < 2} aria-label="Previous match" className="h-10 rounded-panel px-3 text-ui-base ring-1 ring-border hover:bg-accent disabled:opacity-40">↑</button>
          <button type="button" onClick={() => step(1)} disabled={found.length < 2} aria-label="Next match" className="h-10 rounded-panel px-3 text-ui-base ring-1 ring-border hover:bg-accent disabled:opacity-40">↓</button>
        </div>
        <p className="mt-1 min-h-5 text-ui-sm text-muted" role="status" aria-live="polite">
          {note || (dq.trim().length >= 2 ? (found.length ? `${Math.min(active + 1, found.length)} of ${found.length}${found.length >= MAX_MATCHES ? "+" : ""} ${found.length === 1 ? "match" : "matches"}` : "No match in this judgment") : "")}
        </p>
      </div>
      <div className="mt-2 space-y-5">
        {paragraphs.slice(0, shown).map((p, i) => <Para key={i} p={p} hits={byPara.get(i) ?? NONE} activeStart={cur && cur.p === i ? cur.start : -1} num={nums[i].v} numId={nums[i].first} />)}
      </div>
      {collapsed && <div aria-hidden className="pointer-events-none -mt-16 h-16 bg-gradient-to-t from-surface to-transparent print:hidden" />}
      <div className="mt-3 print:hidden" aria-live="polite">
        {collapsed && <button type="button" onClick={() => expandTo(n)} className="h-11 rounded-panel px-4 text-ui-base font-medium text-primary ring-1 ring-border hover:bg-accent">Show full judgment ({n.toLocaleString("en-IN")} paragraphs)</button>}
        {loading && <p className="text-ui-sm text-muted">Loading the judgment: {shown.toLocaleString("en-IN")} of {n.toLocaleString("en-IN")} paragraphs …</p>}
        {shown >= n && n > INITIAL && <p className="text-ui-sm text-muted">The whole judgment is shown, so your browser&rsquo;s Find (Cmd/Ctrl+F), copy and print work on all of it.</p>}
        {collapsed && <p className="mt-2 text-ui-sm text-muted">Showing the first {shown} of {n.toLocaleString("en-IN")} paragraphs. To use your browser&rsquo;s Find or to print the whole judgment, choose Show full judgment first.</p>}
      </div>
      {top && <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top" className="fixed bottom-5 right-4 z-40 inline-flex h-11 items-center gap-1 rounded-chip bg-surface px-4 text-ui-base font-medium text-foreground shadow-md ring-1 ring-border hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary print:hidden">↑ Back to top</button>}
    </div>
  );
}
const NONE: { start: number; end: number }[] = [];
