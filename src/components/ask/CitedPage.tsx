"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge, Eyebrow, MarkedPage, MarkedScope, RepealedNote } from "@/components/kit";
import { hrefOf, sourceLabel } from "@/components/workspace/CitedText";
import { sectionWord } from "@/lib/acts/unitLabel.mjs";
import { amendParts, vocabOf } from "@/lib/chat/amend.mjs";
import { markParagraph, sentencesCiting } from "@/lib/chat/marked.mjs";
import type { Citation } from "@/lib/chat/store";

// The cited page beside an answer: the source the selected chip points to, opened at the paragraph the answer relied on, drawn as the "marked page" (the rest of the page dims).
// Presentation and one fetch (/api/chat/source); choosing the paragraph is src/lib/chat/marked.mjs. Colours, sizes and shapes come from the tokens through the shared kit.
type Loaded = { kind: "act"; title: string; number: string | null; heading: string | null; status: string; body: string | null } | { kind: "judgment"; text: string; page: number | null };
type State = { key: string; data: Loaded | null; error: string };

const sourceKey = (c: Citation) => (c.kind === "judgment" ? `j|${c.caseId}|${c.passage ?? 0}` : c.kind === "doc" ? `d|${c.docId}` : `a|${c.actId}|${c.sectionKey}`);

export default function CitedPage({ source, answer, onClose, nudge = 0, shownN, className = "" }: { source: Citation | null; answer: string; onClose: () => void; /** the number the answer prints for this source (1, 2, 3... in order of use) */ shownN?: number; /** changes whenever the reader picks a chip, so a panel that was hidden (the phone's sheet) scrolls to the marked passage when it is shown */ nudge?: number; className?: string }) {
  const [state, setState] = useState<State>({ key: "", data: null, error: "" }), box = useRef<HTMLElement>(null);
  const key = source ? sourceKey(source) : "";
  useEffect(() => {
    if (!source || source.kind === "doc") return;
    const qs = source.kind === "judgment" ? `caseId=${encodeURIComponent(source.caseId ?? "")}&passage=${source.passage ?? 0}` : `actId=${encodeURIComponent(source.actId)}&sectionKey=${encodeURIComponent(source.sectionKey)}`;
    let live = true;
    fetch(`/api/chat/source?${qs}`).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || "Could not load the source."); if (live) setState({ key, data: j, error: "" }); })
      .catch((e) => { if (live) setState({ key, data: null, error: e.message }); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // once the page is open, scroll the panel (not the window) so the marked passage is in view
  useEffect(() => {
    const el = box.current, m = el?.querySelector<HTMLElement>("[data-marked]"); if (!el || !m) return;
    el.scrollTop += m.getBoundingClientRect().top - el.getBoundingClientRect().top - el.clientHeight / 4;
  }, [state, nudge]);

  const ready = state.key === key, sentences = source ? sentencesCiting(answer, source.n) : [];
  return (
    <aside ref={box} aria-label="Cited page" className={`max-h-[75vh] overflow-y-auto rounded-card bg-surface p-card shadow-sm ring-1 ring-border/60 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <Eyebrow>{source ? `Cited page · ${source.kind === "judgment" ? "case" : source.kind === "doc" ? "your document" : "§"} ${shownN ?? source.n}` : "Cited page"}</Eyebrow>
        <button type="button" onClick={onClose} className="rounded-button px-2 py-1 text-ui-sm text-secondary hover:bg-accent focus-visible:outline-2 lg:hidden">Close</button>
      </div>
      {!source && <p className="mt-3 text-ui-base text-muted">Select a numbered source in the answer to read the cited page here, with the passage the answer relied on marked.</p>}
      {source && (
        <div className="mt-2">
          <p className="text-ui-base font-medium text-foreground">{source.kind === "doc" ? source.docName ?? source.actTitle : source.actTitle}</p>
          <p className="text-ui-sm text-muted">{source.kind === "doc" || source.kind === "judgment" ? sourceLabel(source) : source.state ? source.state.replace(/-/g, " ") : "Central Act"} {source.kind !== "doc" && source.kind !== "judgment" && <RepealedNote actId={source.actId} />}</p>
          {source.kind === "doc" ? (
            <p className="mt-3 text-ui-base text-secondary">{source.preview ?? "A passage of your own document."}{source.scan ? " Read from a scan: check the original." : ""}</p>
          ) : !ready ? <p className="mt-3 text-ui-base text-muted" role="status">Opening the page…</p>
          : state.error ? <p className="mt-3 text-ui-base text-quality-bad" role="alert">{state.error}</p>
          : state.data?.kind === "judgment" ? (
            <div className="mt-3"><Badge title="An excerpt of the judgment, not the whole">Excerpt</Badge>
              <MarkedPage label="Cited excerpt" className="mt-2"><p className="whitespace-pre-line font-serif text-reading leading-reading text-foreground">{state.data.text}</p></MarkedPage></div>
          ) : state.data?.kind === "act" ? <ActPage d={state.data} sentences={sentences} /> : null}
          <p className="mt-3 text-ui-sm"><Link href={hrefOf(source)} className="font-medium text-primary hover:underline">{source.kind === "doc" ? "Open the document" : source.kind === "judgment" ? "Open the judgment" : "Open the whole section"} ›</Link></p>
        </div>
      )}
    </aside>
  );
}

function ActPage({ d, sentences }: { d: Extract<Loaded, { kind: "act" }>; sentences: string[] }) {
  const { paragraphs, marked } = markParagraph(d.body, sentences), vocab = vocabOf(paragraphs);
  return (
    <div className="mt-3">
      <p className="font-serif text-ui-body font-medium text-foreground">{d.number ? `${sectionWord(d.number)}.` : ""} {d.heading ?? ""}</p>
      {d.status === "possibly_incomplete" && <Badge tone="warn" className="mt-1" title="Our copy of this section may be missing text">Possibly incomplete</Badge>}
      {!paragraphs.length ? <p className="mt-2 text-ui-base text-muted">The text of this section is not available here.</p> : (
        <MarkedScope className="mt-2 space-y-2 font-serif text-reading leading-reading text-foreground">
          {paragraphs.map((p, i) => (i === marked ? <MarkedPage key={i} label="Passage the answer relied on"><p><Amended text={p} vocab={vocab} /></p></MarkedPage> : <p key={i}><Amended text={p} vocab={vocab} /></p>))}
        </MarkedScope>
      )}
    </div>
  );
}

/** A paragraph of law with the amendment brackets removed and a small footnote mark where the amended words end (src/lib/chat/amend.mjs). */
function Amended({ text, vocab }: { text: string; vocab: Set<string> }) {
  return <>{amendParts(text, vocab).map((p, i) => (p.t === "text" ? <span key={i}>{p.v}</span> : <sup key={i} title={`Amended text (footnote ${p.n})`} className="ml-0.5 font-sans text-ui-xs text-muted">{p.n}</sup>))}</>;
}
