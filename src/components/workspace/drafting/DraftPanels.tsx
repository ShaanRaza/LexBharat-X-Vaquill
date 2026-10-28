"use client";
import { sectionWord } from "@/lib/acts/unitLabel.mjs";
import Link from "next/link";
import { Badge, CitationChip, Notice, Panel } from "@/components/kit";
import type { BasisItem, Warnings } from "@/lib/drafting/store";

// Panels shared by the generation view and the editor: the legal basis (only sections that were actually retrieved), the "check before you use it" list, and the warnings.
export const sectionHref = (c: { actId: string; sectionKey: string }) => `/law/${c.actId}/${encodeURIComponent(c.sectionKey)}`;
const label = (c: BasisItem) => `${c.actTitle}, ${c.number ? sectionWord(c.number) : "unnumbered text"}`;

export function LegalBasis({ basis, note }: { basis: BasisItem[]; note?: string }) {
  const used = basis.filter((b) => b.used), background = basis.filter((b) => !b.used && b.relied), also = basis.filter((b) => !b.used && !b.relied);
  const Row = ({ b }: { b: BasisItem }) => (
    <li className="flex gap-2">
      <CitationChip n={b.n} href={sectionHref(b)} label={label(b)} />
      <div className="min-w-0 text-ui-sm">
        <Link href={sectionHref(b)} className="font-medium text-primary hover:underline">{b.actTitle}</Link>{b.state ? <span className="text-muted"> · {b.state.replace(/-/g, " ")}</span> : null}
        <p className="text-secondary">{b.number ? `${sectionWord(b.number)}${b.heading ? ` — ${b.heading}` : ""}` : <>Unnumbered text{b.preview ? <span className="text-muted"> — {b.preview}</span> : null}</>}{b.status === "possibly_incomplete" && <Badge tone="warn" className="ml-2" title="Our copy of this section may be missing text">Possibly incomplete</Badge>}</p>
        {b.why && <p className="text-muted">{b.why}</p>}
      </div>
    </li>
  );
  const Group = ({ title, items, badge }: { title: string; items: BasisItem[]; badge?: string }) => items.length ? <><p className="mt-3 flex items-center gap-2 text-ui-xs font-semibold uppercase tracking-caps text-muted">{title}{badge && <Badge tone="complete">{badge}</Badge>}</p><ol className="mt-1.5 space-y-2.5">{items.map((b) => <Row key={b.n} b={b} />)}</ol></> : null;
  return (
    <Panel as="section" aria-label="Legal basis">
      <h3 className="text-ui-base font-semibold">Legal basis</h3>
      <p className="mt-0.5 text-ui-sm text-muted">Only sections retrieved from our Acts are used or cited. Open each one to read the full text.</p>
      {!basis.length && <p className="mt-2 text-ui-sm text-secondary">No Act sections were retrieved for this draft, so it cites none.</p>}
      <Group title="Named in this draft" items={used} />
      <Group title="Relied on by the template" items={background} badge="not quoted" />
      {also.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-ui-sm text-secondary">Also retrieved, not used ({also.length})</summary><ol className="mt-2 space-y-2.5">{also.map((b) => <Row key={b.n} b={b} />)}</ol></details>}
      {note && <p className="mt-2 text-ui-sm text-muted">{note}</p>}
    </Panel>
  );
}

export function Checklist({ items }: { items: { id: string; text: string }[] }) {
  if (!items.length) return null;
  return (
    <Panel as="section" aria-label="Check before you use it">
      <h3 className="text-ui-base font-semibold">Check before you use it</h3>
      <ul className="mt-2 space-y-2">{items.map((i) => <li key={i.id} className="flex gap-2 text-ui-sm text-secondary"><Badge tone="warn" className="mt-0.5 h-fit shrink-0">Check</Badge><span>{i.text}</span></li>)}</ul>
    </Panel>
  );
}

export function WarningsPanel({ warnings }: { warnings: Warnings | undefined }) {
  const u = warnings?.unverified ?? [], a = warnings?.amounts ?? [];
  if (!u.length && !a.length) return null;
  return (
    <Notice tone="warn" role="note" title="Check these points">
      <ul className="list-disc space-y-1 pl-5">
        {u.map((x, i) => <li key={`u${i}`}>The draft mentions “{x.text}”, which was not among the sections retrieved. Check it or remove it.</li>)}
        {a.map((x, i) => <li key={`a${i}`}>The draft contains the amount {x}, which was not in the details you gave or the retrieved law. Check it.</li>)}
      </ul>
    </Notice>
  );
}
