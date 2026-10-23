import type { ReactNode } from "react";

// Shared chip/label. Colours come from the tokens in src/styles/tokens.css through Tailwind names (quality-*, accent, secondary); nothing is hard-coded.
// `tone` is a meaning, not a colour: callers say "warn", the kit decides how that looks.
export type Tone = "neutral" | "complete" | "warn" | "bad" | "info";
const TONE: Record<Tone, string> = {
  neutral: "bg-accent text-secondary",
  complete: "bg-quality-complete/10 text-quality-complete ring-1 ring-quality-complete/30",
  warn: "bg-quality-warn/10 text-quality-warn ring-1 ring-quality-warn/30",
  bad: "bg-quality-bad/10 text-quality-bad ring-1 ring-quality-bad/30",
  info: "bg-accent text-quality-info ring-1 ring-border",
};
export const toneClass = (t: Tone) => TONE[t];

export default function Badge({ tone = "neutral", children, title, className = "" }: { tone?: Tone; children: ReactNode; title?: string; className?: string }) {
  return <span title={title} className={`inline-flex items-center gap-1 rounded-chip px-chip py-0.5 text-ui-xs ${TONE[tone]} ${className}`}>{children}</span>;
}

const DOT: Record<Tone, string> = { neutral: "bg-border", complete: "bg-quality-complete", warn: "bg-quality-warn", bad: "bg-quality-bad", info: "bg-quality-info" };
/** Small coloured marker for list rows; pair it with text for screen readers. */
export function StatusDot({ tone }: { tone: Tone }) { return <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT[tone]}`} />; }
