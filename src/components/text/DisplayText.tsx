import { cleanParts } from "@/lib/text/clean.mjs";

// THE way to show a paragraph of text taken from the data in a reading view: junk removed, amendment numbers shown as small footnote marks, spacing and joined words repaired (src/lib/text/clean.mjs).
// `vocab` (vocabOf the section's paragraphs) lets "thecheque" read "the cheque". Used by the law page and beside an Ask answer.
export default function DisplayText({ text, vocab }: { text: string; vocab?: Set<string> }) {
  return <>{cleanParts(text, vocab).map((p, i) => (p.t === "text" ? <span key={i}>{p.v}</span> : <sup key={i} title={`Amended text (footnote ${p.n})`} className="ml-0.5 font-sans text-ui-xs text-muted">{p.n}</sup>))}</>;
}
