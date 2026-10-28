import Link from "next/link";
import { LOCKUP, MARK } from "@/lib/brand";

// The LexBharat logo, direction 1a: the pilcrow with a trace line, alone (`mark`) or with the wordmark. One colour: it follows the text colour, set here from the tokens (`tone="light"` is for the dark glow).
// Heights come from the --logo-h-* tokens.
const HEIGHT = { sm: "var(--logo-h-sm)", md: "var(--logo-h)", lg: "var(--logo-h-lg)" } as const;
export function LogoMark({ size = "md", tone = "brand", className = "" }: { size?: keyof typeof HEIGHT; tone?: "brand" | "light"; className?: string }) {
  return <Logo mark size={size} tone={tone} className={className} />;
}
export default function Logo({ href, size = "md", tone = "brand", mark = false, className = "" }: { href?: string; size?: keyof typeof HEIGHT; tone?: "brand" | "light"; mark?: boolean; className?: string }) {
  const d = mark ? { w: MARK.w, h: MARK.h, paths: MARK.paths } : { w: LOCKUP.w, h: LOCKUP.h, paths: [...LOCKUP.mark, LOCKUP.lex, LOCKUP.bharat] };
  const svg = (
    <svg viewBox={`0 0 ${d.w} ${d.h}`} fill="currentColor" aria-hidden="true" style={{ height: HEIGHT[size], width: "auto", aspectRatio: `${d.w} / ${d.h}` }}>
      {d.paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
  const cls = `inline-flex items-center ${tone === "light" ? "text-white" : "text-primary"} ${className}`;
  return href
    ? <Link href={href} aria-label="LexBharat" className={`${cls} rounded-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}>{svg}</Link>
    : <span className={cls} role="img" aria-label="LexBharat">{svg}</span>;
}
