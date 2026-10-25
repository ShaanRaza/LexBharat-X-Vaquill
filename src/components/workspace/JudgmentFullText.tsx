import StatuteText from "./StatuteLinks";
import { Notice } from "@/components/kit";
import type { Resolved } from "@/lib/judgments/statuteResolve";
import type { ScChunk } from "@/lib/judgments/scText";

// The full English text of a Supreme Court judgment, one block per extracted passage in reading order (by character offset in the report), with each Act section it names linked where we hold it.
// Passages that contain text in another script are marked. Presentation only; colours, sizes and radii come from the tokens.
const INDIC = /[ऀ-෿]/;

export default function JudgmentFullText({ chunks, mentions }: { chunks: ScChunk[]; mentions: Resolved[] }) {
  let off = 0;
  const blocks = chunks.map((c) => {
    const start = off, end = off + c.t.length; off = end + 2;   // "\n\n" between passages in the joined text the mentions were found in
    const own = mentions.filter((m) => m.start >= start && m.end <= end).map((m) => ({ ...m, start: m.start - start, end: m.end - start }));
    return { c, own };
  });
  const mixed = chunks.filter((c) => INDIC.test(c.t)).length;
  return (
    <section aria-labelledby="fulltext" className="mt-5 rounded-card bg-surface p-5 shadow-sm ring-1 ring-border/60">
      <h2 id="fulltext" className="text-ui-xs font-semibold uppercase tracking-[0.08em] text-secondary">Judgment text (English, as extracted from the report)</h2>
      <p className="mt-1 text-ui-sm text-secondary">{chunks.length} passages in reading order. Extracted by machine from the printed report: line breaks, running heads and OCR errors are possible. Check the original before quoting.</p>
      {mixed > 0 && <Notice tone="warn" compact className="mt-3"><p>{mixed} {mixed === 1 ? "passage contains" : "passages contain"} text in another script (marked below); the English reading of those lines may be incomplete.</p></Notice>}
      <div className="mt-3 space-y-3">
        {blocks.map(({ c, own }) => (
          <p key={c.i} id={`passage-${c.i}`} className={`scroll-mt-24 whitespace-pre-line text-ui-body leading-relaxed target:bg-primary/10 ${INDIC.test(c.t) ? "rounded-control border-l-2 border-quality-warn pl-3" : ""}`}>
            <StatuteText text={c.t} mentions={own} />
            {c.ps ? <span className="ml-2 text-ui-xs text-muted" title="Page of the report where this passage starts">[p. {c.ps}]</span> : null}
            {INDIC.test(c.t) ? <span className="ml-2 text-ui-xs text-quality-warn">(contains another script)</span> : null}
          </p>
        ))}
      </div>
    </section>
  );
}
