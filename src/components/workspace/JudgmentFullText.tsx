import { Notice } from "@/components/kit";
import type { Resolved, ScChunk } from "@/lib/legal-data";
import { LawsReferred } from "./StatuteLinks";
import { lawsReferred } from "@/lib/legal-data";
import JudgmentReader, { type ReaderPara } from "./JudgmentReader";

// The full English text of a Supreme Court judgment. Prepared here on the server (paragraphs in reading order by character offset in the report, each with the Act-section links found in it);
// the reading experience (first paragraphs, "Show full judgment", search inside, paragraph numbers, back to top) is JudgmentReader. Passages that contain text in another script are marked.
const INDIC = /[\u0900-\u0DFF]/;
/** Margin letters of the printed report (a lone "A" to "H" on a line) are not text of the judgment: they are left out of the display only (the stored text is unchanged). */
const MARGIN = /^[A-H]$/;

export default function JudgmentFullText({ chunks, mentions }: { chunks: ScChunk[]; mentions: Resolved[] }) {
  let off = 0;
  const paragraphs: ReaderPara[] = [];
  for (const c of chunks) {
    const start = off; off = start + c.t.length + 2;   // "\n\n" between passages in the joined text the mentions were found in
    let at = 0, first = true;
    for (const t of c.t.split(/\n{2,}/)) {
      const i = c.t.indexOf(t, at); at = i + t.length;
      if (!t.trim() || MARGIN.test(t.trim())) continue;
      const lo = start + i, hi = lo + t.length;
      paragraphs.push({ chunk: c.i, first, page: c.ps ?? null, indic: INDIC.test(c.t), t, m: mentions.filter((m) => m.start >= lo && m.end <= hi).map((m) => ({ start: m.start - lo, end: m.end - lo, href: m.href, title: `${m.label} of ${m.actName}${m.state === "missing" ? " (missing from our source data)" : ""}` })) });
      first = false;
    }
  }
  const mixed = chunks.filter((c) => INDIC.test(c.t)).length;
  return (
    <section aria-labelledby="fulltext" className="mt-5 rounded-card bg-surface p-5 shadow-sm ring-1 ring-border/60">
      <h2 id="fulltext" className="scroll-mt-24 text-ui-xs font-semibold uppercase tracking-caps text-secondary">Judgment text (English, as extracted from the report)</h2>
      <p className="mt-1 text-ui-sm text-secondary">{chunks.length} {chunks.length === 1 ? "passage" : "passages"}, {paragraphs.length.toLocaleString("en-IN")} paragraphs, in reading order. Extracted by machine from the printed report: line breaks, running heads and OCR errors are possible, and the margin letters (A, B, C …) of the printed report are left out. Check the original before quoting.</p>
      {mixed > 0 && <Notice tone="warn" compact className="mt-3"><p>{mixed} {mixed === 1 ? "passage contains" : "passages contain"} text in another script (marked below); the English reading of those lines may be incomplete.</p></Notice>}
      <div className="mt-4"><JudgmentReader paragraphs={paragraphs} /></div>
      <LawsReferred laws={lawsReferred(mentions)} />
    </section>
  );
}
