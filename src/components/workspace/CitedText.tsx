"use client";
import { sectionWord } from "@/lib/acts/unitLabel.mjs";
import Link from "next/link";
import { Fragment } from "react";
import { CitationChip } from "@/components/kit";
import { linkSegments } from "@/lib/chat/citations.mjs";
import type { Citation } from "@/lib/chat/store";

// Text with citation chips and linked statute names, shared by Chat answers and Review. A source is either a section of an Act (links to that section) or a passage of the user's own document
// (links to the document's preview at that page, drawn as a different kind of chip). Presentation only; the splitting logic is src/lib/chat/citations.mjs.
export const sectionHref = (c: { actId: string; sectionKey: string }) => `/law/${c.actId}/${encodeURIComponent(c.sectionKey)}`;
export const docHref = (c: Citation) => `/work/vault/${c.docId}${c.page ? `?page=${c.page}` : ""}`;
export const judgmentHref = (c: Citation) => `/judgments/supreme-court-of-india/${c.caseYear}/${encodeURIComponent(c.caseId ?? "")}${c.passage !== undefined ? `#passage-${c.passage}` : ""}`;
export const hrefOf = (c: Citation) => (c.kind === "doc" ? docHref(c) : c.kind === "judgment" ? judgmentHref(c) : sectionHref(c));
/** "NDA.pdf, page 3, 4. Non-compete" or "Indian Contract Act, 1872, Section 27" */
export const sourceLabel = (c: Citation) => c.kind === "judgment" ? `${c.actTitle}${c.label ? `, ${c.label}` : ""}${c.page ? `, page ${c.page}` : ""} (Supreme Court)` : c.kind === "doc" ? `${c.docName ?? c.actTitle}${c.page ? `, page ${c.page}` : ""}${c.label ? `, ${c.label}` : ""}${c.scan ? ", read from scan" : ""}` : `${c.actTitle}, ${c.number ? sectionWord(c.number) : "unnumbered text"}`;

export default function CitedText({ text, sources, onPick, activeN }: { text: string; sources: Citation[]; onPick?: (n: number) => void; activeN?: number }) {
  return <>{linkSegments(text, sources).map((p, i) => {
    if (p.type === "text") return <Fragment key={i}>{p.text}</Fragment>;
    const c = sources.find((s) => s.n === p.n)!;
    if (p.type === "cite") return <CitationChip key={i} n={p.n} href={hrefOf(c)} label={sourceLabel(c)} kind={c.kind === "doc" ? "doc" : c.kind === "judgment" ? "judgment" : "act"} onSelect={onPick} active={activeN === p.n} />;
    return <Link key={i} href={hrefOf(c)} title={sourceLabel(c)} className="font-medium text-primary underline decoration-primary/40 hover:decoration-primary">{p.text}</Link>;
  })}</>;
}
