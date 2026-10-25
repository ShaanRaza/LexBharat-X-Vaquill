import StatuteText from "./StatuteLinks";
import { Notice } from "@/components/kit";
import type { Resolved } from "@/lib/judgments/statuteResolve";
import type { ScChunk } from "@/lib/judgments/scText";

// The full English text of a Supreme Court judgment, one block per extracted passage in reading order (by character offset in the report), with each Act section it names linked where we hold it.
// Passages that contain text in another script are marked. Presentation only; colours, sizes and radii come from the tokens.
const INDIC = /[ऀ-෿]/;

/** Margin letters of the printed report (a lone "A" to "H" on a line) are not text of the judgment: they are left out of the display only (the stored text is unchanged). */
const MARGIN = /^[A-H]$/;

export default function JudgmentFullText({ chunks, mentions }: { chunks: ScChunk[]; mentions: Resolved[] }) {
  let off = 0;
  const blocks = chunks.map((c) => {
    const start = off; off = start + c.t.length + 2;   // "\n\n" between passages in the joined text the mentions were found in
    let at = 0;
    const paras = c.t.split(/\n{2,}/).flatMap((t) => {
      const i = c.t.indexOf(t, at); at = i + t.length;
      if (!t.trim() || MARGIN.test(t.trim())) return [];
      const lo = start + i, hi = lo + t.length;
      return [{ t, own: mentions.filter((m) => m.start >= lo && m.end <= hi).map((m) => ({ ...m, start: m.start - lo, end: m.end - lo })) }];
    });
    return { c, paras };
  });
  const mixed = chunks.filter((c) => INDIC.test(c.t)).length;
  return (
    <section aria-labelledby="fulltext" className="mt-5 rounded-card bg-surface p-5 shadow-sm ring-1 ring-border/60">
      <h2 id="fulltext" className="scroll-mt-24 text-ui-xs font-semibold uppercase tracking-[0.08em] text-secondary">Judgment text (English, as extracted from the report)</h2>
      <p className="mt-1 text-ui-sm text-secondary">{chunks.length} {chunks.length === 1 ? "passage" : "passages"} in reading order. Extracted by machine from the printed report: line breaks, running heads and OCR errors are possible, and the margin letters (A, B, C …) of the printed report are left out. Check the original before quoting.</p>
      {mixed > 0 && <Notice tone="warn" compact className="mt-3"><p>{mixed} {mixed === 1 ? "passage contains" : "passages contain"} text in another script (marked below); the English reading of those lines may be incomplete.</p></Notice>}
      <div className="mt-3 space-y-5">
        {blocks.map(({ c, paras }) => (
          <div key={c.i} id={`passage-${c.i}`} className={`scroll-mt-24 space-y-2 target:rounded-control target:bg-primary/10 ${INDIC.test(c.t) ? "rounded-control border-l-2 border-quality-warn pl-3" : ""}`}>
            {(c.ps || INDIC.test(c.t)) && <p className="text-ui-xs text-muted">{c.ps ? <span title="Page of the report where this passage starts">Page {c.ps}</span> : null}{INDIC.test(c.t) ? <span className="ml-2 text-quality-warn">Contains another script</span> : null}</p>}
            {paras.map((p, i) => <p key={i} className="whitespace-pre-line text-ui-body leading-relaxed"><StatuteText text={p.t} mentions={p.own} /></p>)}
          </div>
        ))}
      </div>
    </section>
  );
}
