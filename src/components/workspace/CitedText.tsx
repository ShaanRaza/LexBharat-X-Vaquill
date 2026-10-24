"use client";
import Link from "next/link";
import { Fragment } from "react";
import { CitationChip } from "@/components/kit";
import { linkSegments } from "@/lib/chat/citations.mjs";
import type { Citation } from "@/lib/chat/store";

// Text with citation chips and linked statute names, shared by Chat answers and Review. A source is either a section of an Act (links to that section) or a passage of the user's own document
// (links to the document's preview at that page, drawn as a different kind of chip). Presentation only; the splitting logic is src/lib/chat/citations.mjs.
export const sectionHref = (c: { actId: string; sectionKey: string }) => `/workspace/browse/acts/${c.actId}?section=${encodeURIComponent(c.sectionKey)}`;
export const docHref = (c: Citation) => `/workspace/vault/${c.docId}${c.page ? `?page=${c.page}` : ""}`;
export const hrefOf = (c: Citation) => (c.kind === "doc" ? docHref(c) : sectionHref(c));
/** "NDA.pdf, page 3, 4. Non-compete" or "Indian Contract Act, 1872, Section 27" */
export const sourceLabel = (c: Citation) => c.kind === "doc" ? `${c.docName ?? c.actTitle}${c.page ? `, page ${c.page}` : ""}${c.label ? `, ${c.label}` : ""}` : `${c.actTitle}, ${c.number ? `Section ${c.number}` : "unnumbered text"}`;

export default function CitedText({ text, sources }: { text: string; sources: Citation[] }) {
  return <>{linkSegments(text, sources).map((p, i) => {
    if (p.type === "text") return <Fragment key={i}>{p.text}</Fragment>;
    const c = sources.find((s) => s.n === p.n)!;
    if (p.type === "cite") return <CitationChip key={i} n={p.n} href={hrefOf(c)} label={sourceLabel(c)} kind={c.kind === "doc" ? "doc" : "act"} />;
    return <Link key={i} href={hrefOf(c)} title={sourceLabel(c)} className="font-medium text-primary underline decoration-primary/40 hover:decoration-primary">{p.text}</Link>;
  })}</>;
}
