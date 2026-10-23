import { splitHighlight } from "@/lib/acts/highlight.mjs";

// Shared highlighted snippet. The look of a match is the `mark` style below; it uses the tokens (primary tint), so a reskin changes it in one place.
export default function Highlight({ snippet }: { snippet: string }) {
  return <>{splitHighlight(snippet).map((p, i) => (p.hit ? <mark key={i} className="rounded-control bg-primary/15 px-0.5 text-foreground">{p.text}</mark> : <span key={i}>{p.text}</span>))}</>;
}
