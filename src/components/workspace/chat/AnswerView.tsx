"use client";
import Link from "next/link";
import { Fragment } from "react";
import { Badge, CitationChip, Notice } from "@/components/kit";
import { linkSegments } from "@/lib/chat/citations.mjs";
import { toBlocks } from "@/lib/chat/format.mjs";
import type { Citation, CheckResult } from "@/lib/chat/store";

// One assistant answer: text with numbered citation chips and linked statute names, the answer-check label, and the list of sources used. Presentation only; the logic is in src/lib/chat.
export const sectionHref = (c: { actId: string; sectionKey: string }) => `/workspace/browse/acts/${c.actId}?section=${encodeURIComponent(c.sectionKey)}`;
const sourceLabel = (c: Citation) => `${c.actTitle}, ${c.number ? `Section ${c.number}` : "text block"}`;
const CHECK = { supported: { tone: "complete", text: "Supported", explain: "The sections cited back up what the answer says." }, partial: { tone: "warn", text: "Partly supported", explain: "Some statements are not fully backed by the sections found." }, check: { tone: "bad", text: "Check sources", explain: "Read the sources before relying on this answer." } } as const;

function Inline({ text, sources }: { text: string; sources: Citation[] }) {
  return <>{linkSegments(text, sources).map((p, i) => {
    if (p.type === "text") return <Fragment key={i}>{p.text}</Fragment>;
    const c = sources.find((s) => s.n === p.n)!;
    if (p.type === "cite") return <CitationChip key={i} n={p.n} href={sectionHref(c)} label={sourceLabel(c)} />;
    return <Link key={i} href={sectionHref(c)} title={sourceLabel(c)} className="font-medium text-primary underline decoration-primary/40 hover:decoration-primary">{p.text}</Link>;
  })}</>;
}

export default function AnswerView({ text, sources, check, pending }: { text: string; sources: Citation[]; check?: CheckResult | null; pending?: boolean }) {
  const blocks = toBlocks(text);
  return (
    <div>
      <div className="space-y-3 text-ui-body leading-relaxed text-foreground">
        {blocks.map((b, i) => b.type === "p" ? <p key={i}><Inline text={b.text} sources={sources} /></p>
          : b.type === "ul" ? <ul key={i} className="list-disc space-y-1 pl-5">{b.items.map((it, j) => <li key={j}><Inline text={it} sources={sources} /></li>)}</ul>
          : <ol key={i} className="list-decimal space-y-1 pl-5">{b.items.map((it, j) => <li key={j}><Inline text={it} sources={sources} /></li>)}</ol>)}
        {pending && <span aria-hidden className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-muted align-middle" />}
      </div>
      {!pending && check && (
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
        </div>
      )}
      {sources.length > 0 && !pending && (
        <details className="mt-3 text-ui-sm">
          <summary className="cursor-pointer text-secondary">Sources searched ({sources.length})</summary>
          <ol className="mt-2 space-y-1.5">
            {sources.map((s) => (
              <li key={s.n} className="flex flex-wrap items-baseline gap-x-2">
                <CitationChip n={s.n} href={sectionHref(s)} label={sourceLabel(s)} />
                <Link href={sectionHref(s)} className="text-primary hover:underline">{s.number ? `Section ${s.number}` : "Text block"}{s.heading ? ` — ${s.heading}` : ""}</Link>
                <span className="text-muted">{s.actTitle}{s.state ? ` · ${s.state.replace(/-/g, " ")}` : ""}</span>
                {s.status === "possibly_incomplete" && <Badge tone="warn" title="Our copy of this section may be missing text">Possibly incomplete</Badge>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
