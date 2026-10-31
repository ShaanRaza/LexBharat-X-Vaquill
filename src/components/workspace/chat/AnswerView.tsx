"use client";
import { unitWord } from "@/lib/docs/docType.mjs";
import { SCAN_LABEL } from "@/lib/vault/scan.mjs";
import Link from "next/link";
import { Badge, CitationChip, Notice, RepealedNote } from "@/components/kit";
import CitedText, { hrefOf, sourceLabel } from "@/components/workspace/CitedText";
import { citedNumbers, displayNumbers } from "@/lib/chat/citations.mjs";
import { toBlocks } from "@/lib/chat/format.mjs";
import type { Citation, CheckResult } from "@/lib/chat/store";
import { cleanLabel } from "@/lib/text/clean.mjs";

// One assistant answer: text with numbered citation chips and linked statute names, the answer-check label, and the list of sources used. Presentation only; the logic is in src/lib/chat.
// The four honest labels (src/lib/chat/prompt.mjs CHECK_LABELS): complete and backed / some claims unbacked / incomplete or only partly covered / nothing found.
const CHECK = {
  supported: { tone: "complete", text: "Supported", explain: "The answer is complete and the sections cited back up every statement." },
  partial: { tone: "warn", text: "Partly supported", explain: "Some statements are not backed by the sections found." },
  check: { tone: "bad", text: "Check sources", explain: "The sections found only partly cover the question, or the answer is incomplete. Read the sources before relying on it." },
  not_found: { tone: "neutral", text: "Not found in the Acts", explain: "The Acts searched do not answer this question." },
} as const;


/** One source: its chip, then the Act name FIRST (every source shows it), then the section (or "Unnumbered text" with a short preview). A passage of the user's own document shows the document name and page instead. */
function SourceRow({ c, onPick, activeN, shown }: { c: Citation; onPick?: (n: number) => void; activeN?: number; shown?: Map<number, number> }) {
  if (c.kind === "judgment") return (
    <li className="flex gap-2">
      <span className="shrink-0 self-start"><CitationChip n={c.n} href={hrefOf(c)} label={sourceLabel(c)} kind="judgment" onSelect={onPick} active={activeN === c.n} shown={shown?.get(c.n)} /></span>
      <div className="min-w-0">
        <Link href={hrefOf(c)} className="font-medium text-foreground hover:underline">{c.actTitle}</Link>
        <p className="text-secondary">Supreme Court judgment{c.label ? ` · ${c.label}` : ""}{c.page ? ` · page ${c.page}` : ""} <Badge title="An excerpt of the judgment, not the whole">Excerpt</Badge></p>
      </div>
    </li>
  );
  if (c.kind === "doc") return (
    <li className="flex gap-2">
      <span className="shrink-0 self-start"><CitationChip n={c.n} href={hrefOf(c)} label={sourceLabel(c)} kind="doc" onSelect={onPick} active={activeN === c.n} shown={shown?.get(c.n)} /></span>
      <div className="min-w-0">
        <Link href={hrefOf(c)} className="font-medium text-quality-info hover:underline">{c.docName ?? c.actTitle}</Link>
        <p className="text-secondary">{c.page ? `Page ${c.page}` : "Document text"}{c.label ? ` · ${c.label}` : ""}{c.scan ? <span className="text-quality-warn"> · {SCAN_LABEL}</span> : null}{c.preview ? <span className="text-muted"> — {cleanLabel(c.preview)}</span> : null}</p>
      </div>
    </li>
  );
  return (
    <li className="flex gap-2">
      <span className="shrink-0 self-start"><CitationChip n={c.n} href={hrefOf(c)} label={sourceLabel(c)} onSelect={onPick} active={activeN === c.n} shown={shown?.get(c.n)} /></span>
      <div className="min-w-0">
        <Link href={hrefOf(c)} className="font-medium text-primary hover:underline">{c.actTitle}</Link>
        <span className="text-muted">{c.state ? ` · ${c.state.replace(/-/g, " ")}` : ""}</span> <RepealedNote actId={c.actId} />
        <p className="text-secondary">
          {c.number ? `${unitWord(c.number, { title: c.actTitle, category: c.category })}${c.heading ? ` — ${cleanLabel(c.heading)}` : ""}` : <>Unnumbered text{c.preview ? <span className="text-muted"> — {cleanLabel(c.preview)}</span> : null}</>}
          {c.status === "possibly_incomplete" && <Badge tone="warn" className="ml-2" title="Our copy of this section may be missing text">Possibly incomplete</Badge>}
        </p>
      </div>
    </li>
  );
}

export default function AnswerView({ text, sources, check, pending, queries, note, onPick, activeN }: { text: string; sources: Citation[]; check?: CheckResult | null; pending?: boolean; queries?: string[]; note?: string; onPick?: (n: number) => void; activeN?: number }) {
  const blocks = toBlocks(text), nums = new Set(citedNumbers(text)), shown = displayNumbers(text, sources), byShown = (a: Citation, b: Citation) => (shown.get(a.n) ?? 0) - (shown.get(b.n) ?? 0);   // the numbers printed run 1, 2, 3... in the order the answer uses them
  const cited = sources.filter((x) => nums.has(x.n) && x.kind !== "doc").sort(byShown), citedDocs = sources.filter((x) => nums.has(x.n) && x.kind === "doc").sort(byShown), others = sources.filter((x) => !nums.has(x.n)).sort(byShown);
  return (
    <div>
      {note && <Notice tone="info" role="note" compact className="mb-3"><p>{note}</p></Notice>}
      <div className="space-y-3 text-ui-body leading-relaxed text-foreground">
        {blocks.map((b, i) => b.type === "p" ? <p key={i}><CitedText text={b.text} sources={sources} onPick={onPick} activeN={activeN} shown={shown} /></p>
          : b.type === "ul" ? <ul key={i} className="list-disc space-y-1 pl-5">{b.items.map((it, j) => <li key={j}><CitedText text={it} sources={sources} onPick={onPick} activeN={activeN} shown={shown} /></li>)}</ul>
          : <ol key={i} className="list-decimal space-y-1 pl-5">{b.items.map((it, j) => <li key={j}><CitedText text={it} sources={sources} onPick={onPick} activeN={activeN} shown={shown} /></li>)}</ol>)}
        {pending && <span aria-hidden className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-muted align-middle" />}
      </div>
      {!pending && check?.cutOff && <Notice tone="warn" role="note" compact className="mt-3"><p><strong className="font-medium text-foreground">The answer was cut off.</strong> Try again.</p></Notice>}
      {!pending && check?.absent?.map((a, i) => (   // a section the library does not hold: the plain sentence is in the answer; here is where to read it
        <Notice key={i} tone="info" role="note" compact className="mt-3"><p>{a.kind === "mentioned" ? `${a.text} ` : ""}{a.url && <> <a href={a.url} title={a.actTitle || undefined} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline decoration-primary/40 hover:decoration-primary">{a.label} ›</a></>}</p></Notice>
      ))}
      {!pending && check && !check.cutOff && (
        <div className="mt-3 space-y-2">
          <p className="flex flex-wrap items-center gap-2">
            <Badge tone={CHECK[check.label].tone} title={CHECK[check.label].explain}>{CHECK[check.label].text}</Badge>
            {!(check.label === "not_found" && check.absent?.length) && <span className="text-ui-sm text-muted">{check.unavailable ? "The automatic check could not run." : CHECK[check.label].explain}</span>}   {/* a missing section is already said once, above: the label stays, its explanation would say it a third time */}
          </p>
          {check.unsupported.length > 0 && (
            <Notice tone="warn" role="note" compact title="Not backed by the sources">
              <ul className="list-disc space-y-0.5 pl-5">{check.unsupported.map((u, i) => <li key={i}>{u}</li>)}</ul>
            </Notice>
          )}
          {(check.missing?.length ?? 0) > 0 && (
            <Notice tone="warn" role="note" compact title="Not covered by the sections found">
              <ul className="list-disc space-y-0.5 pl-5">{check.missing!.map((u, i) => <li key={i}>{u}</li>)}</ul>
            </Notice>
          )}
        </div>
      )}
      {sources.length > 0 && !pending && (
        <div className="mt-4 space-y-2">
          {citedDocs.length > 0 && (
            <section aria-label="Passages of your documents cited">
              <h3 className="text-ui-sm font-semibold uppercase tracking-caps text-muted">Your documents cited</h3>
              <ol className="mt-1.5 space-y-2">{citedDocs.map((c) => <SourceRow key={c.n} c={c} onPick={onPick} activeN={activeN} shown={shown} />)}</ol>
            </section>
          )}
          {cited.length > 0 && (
            <section aria-label="Sources cited">
              <h3 className="text-ui-sm font-semibold uppercase tracking-caps text-muted">Sources cited</h3>
              <ol className="mt-1.5 space-y-2">{cited.map((c) => <SourceRow key={c.n} c={c} onPick={onPick} activeN={activeN} shown={shown} />)}</ol>
            </section>
          )}
          {others.length > 0 && (
            <details className="text-ui-sm">
              <summary className="cursor-pointer text-secondary">Also searched ({others.length})</summary>
              {queries && queries.length > 0 && <p className="mt-2 text-muted">Searched for: {queries.map((q, i) => <span key={i}>{i > 0 ? " · " : ""}&ldquo;{q}&rdquo;</span>)}</p>}
              <ol className="mt-2 space-y-2">{others.map((c) => <SourceRow key={c.n} c={c} onPick={onPick} activeN={activeN} shown={shown} />)}</ol>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
