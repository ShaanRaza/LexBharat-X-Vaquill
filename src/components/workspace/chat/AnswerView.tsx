"use client";
import { sectionWord } from "@/lib/acts/unitLabel.mjs";
import { SCAN_LABEL } from "@/lib/vault/scan.mjs";
import Link from "next/link";
import { Badge, CitationChip, Notice, RepealedNote } from "@/components/kit";
import CitedText, { hrefOf, sourceLabel } from "@/components/workspace/CitedText";
import { citedNumbers } from "@/lib/chat/citations.mjs";
import { toBlocks } from "@/lib/chat/format.mjs";
import type { Citation, CheckResult } from "@/lib/chat/store";

// One assistant answer: text with numbered citation chips and linked statute names, the answer-check label, and the list of sources used. Presentation only; the logic is in src/lib/chat.
// The four honest labels (src/lib/chat/prompt.mjs CHECK_LABELS): complete and backed / some claims unbacked / incomplete or only partly covered / nothing found.
const CHECK = {
  supported: { tone: "complete", text: "Supported", explain: "The answer is complete and the sections cited back up every statement." },
  partial: { tone: "warn", text: "Partly supported", explain: "Some statements are not backed by the sections found." },
  check: { tone: "bad", text: "Check sources", explain: "The sections found only partly cover the question, or the answer is incomplete. Read the sources before relying on it." },
  not_found: { tone: "neutral", text: "Not found in the Acts", explain: "The Acts searched do not answer this question." },
} as const;

const Inline = CitedText;

/** One source: its chip, then the Act name FIRST (every source shows it), then the section (or "Unnumbered text" with a short preview). A passage of the user's own document shows the document name and page instead. */
function SourceRow({ c }: { c: Citation }) {
  if (c.kind === "judgment") return (
    <li className="flex gap-2">
      <span className="shrink-0 self-start"><CitationChip n={c.n} href={hrefOf(c)} label={sourceLabel(c)} kind="judgment" /></span>
      <div className="min-w-0">
        <Link href={hrefOf(c)} className="font-medium text-foreground hover:underline">{c.actTitle}</Link>
        <p className="text-secondary">Supreme Court judgment{c.label ? ` · ${c.label}` : ""}{c.page ? ` · page ${c.page}` : ""} <Badge title="An excerpt of the judgment, not the whole">Excerpt</Badge></p>
      </div>
    </li>
  );
  if (c.kind === "doc") return (
    <li className="flex gap-2">
      <span className="shrink-0 self-start"><CitationChip n={c.n} href={hrefOf(c)} label={sourceLabel(c)} kind="doc" /></span>
      <div className="min-w-0">
        <Link href={hrefOf(c)} className="font-medium text-quality-info hover:underline">{c.docName ?? c.actTitle}</Link>
        <p className="text-secondary">{c.page ? `Page ${c.page}` : "Document text"}{c.label ? ` · ${c.label}` : ""}{c.scan ? <span className="text-quality-warn"> · {SCAN_LABEL}</span> : null}{c.preview ? <span className="text-muted"> — {c.preview}</span> : null}</p>
      </div>
    </li>
  );
  return (
    <li className="flex gap-2">
      <span className="shrink-0 self-start"><CitationChip n={c.n} href={hrefOf(c)} label={sourceLabel(c)} /></span>
      <div className="min-w-0">
        <Link href={hrefOf(c)} className="font-medium text-primary hover:underline">{c.actTitle}</Link>
        <span className="text-muted">{c.state ? ` · ${c.state.replace(/-/g, " ")}` : ""}</span> <RepealedNote actId={c.actId} />
        <p className="text-secondary">
          {c.number ? `${sectionWord(c.number)}${c.heading ? ` — ${c.heading}` : ""}` : <>Unnumbered text{c.preview ? <span className="text-muted"> — {c.preview}</span> : null}</>}
          {c.status === "possibly_incomplete" && <Badge tone="warn" className="ml-2" title="Our copy of this section may be missing text">Possibly incomplete</Badge>}
        </p>
      </div>
    </li>
  );
}

export default function AnswerView({ text, sources, check, pending, queries, note }: { text: string; sources: Citation[]; check?: CheckResult | null; pending?: boolean; queries?: string[]; note?: string }) {
  const blocks = toBlocks(text), nums = new Set(citedNumbers(text)), cited = sources.filter((x) => nums.has(x.n) && x.kind !== "doc"), citedDocs = sources.filter((x) => nums.has(x.n) && x.kind === "doc"), others = sources.filter((x) => !nums.has(x.n));
  return (
    <div>
      {note && <Notice tone="info" role="note" compact className="mb-3"><p>{note}</p></Notice>}
      <div className="space-y-3 text-ui-body leading-relaxed text-foreground">
        {blocks.map((b, i) => b.type === "p" ? <p key={i}><Inline text={b.text} sources={sources} /></p>
          : b.type === "ul" ? <ul key={i} className="list-disc space-y-1 pl-5">{b.items.map((it, j) => <li key={j}><Inline text={it} sources={sources} /></li>)}</ul>
          : <ol key={i} className="list-decimal space-y-1 pl-5">{b.items.map((it, j) => <li key={j}><Inline text={it} sources={sources} /></li>)}</ol>)}
        {pending && <span aria-hidden className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-muted align-middle" />}
      </div>
      {!pending && check?.cutOff && <Notice tone="warn" role="note" compact className="mt-3"><p><strong className="font-medium text-foreground">The answer was cut off.</strong> Try again.</p></Notice>}
      {!pending && check && !check.cutOff && (
        <div className="mt-3 space-y-2">
          <p className="flex flex-wrap items-center gap-2">
            <Badge tone={CHECK[check.label].tone} title={CHECK[check.label].explain}>{CHECK[check.label].text}</Badge>
            <span className="text-ui-sm text-muted">{check.unavailable ? "The automatic check could not run." : CHECK[check.label].explain}</span>
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
              <h3 className="text-ui-sm font-semibold uppercase tracking-[0.08em] text-muted">Your documents cited</h3>
              <ol className="mt-1.5 space-y-2">{citedDocs.map((c) => <SourceRow key={c.n} c={c} />)}</ol>
            </section>
          )}
          {cited.length > 0 && (
            <section aria-label="Sources cited">
              <h3 className="text-ui-sm font-semibold uppercase tracking-[0.08em] text-muted">Sources cited</h3>
              <ol className="mt-1.5 space-y-2">{cited.map((c) => <SourceRow key={c.n} c={c} />)}</ol>
            </section>
          )}
          {others.length > 0 && (
            <details className="text-ui-sm">
              <summary className="cursor-pointer text-secondary">Also searched ({others.length})</summary>
              {queries && queries.length > 0 && <p className="mt-2 text-muted">Searched for: {queries.map((q, i) => <span key={i}>{i > 0 ? " · " : ""}&ldquo;{q}&rdquo;</span>)}</p>}
              <ol className="mt-2 space-y-2">{others.map((c) => <SourceRow key={c.n} c={c} />)}</ol>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
