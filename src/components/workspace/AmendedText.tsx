import { amendParts } from "@/lib/chat/amend.mjs";

// A paragraph of law with the amendment brackets removed and a small footnote mark where the amended words end (the parsing is src/lib/chat/amend.mjs). Used on the law page and beside an Ask answer.
export default function AmendedText({ text, vocab }: { text: string; vocab?: Set<string> }) {
  return <>{amendParts(text, vocab).map((p, i) => (p.t === "text" ? <span key={i}>{p.v}</span> : <sup key={i} title={`Amended text (footnote ${p.n})`} className="ml-0.5 font-sans text-ui-xs text-muted">{p.n}</sup>))}</>;
}
