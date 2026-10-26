import Link from "next/link";

// The LexBharat logo for now: an "LB" tile and the wordmark ("Lex" regular, "Bharat" bold, Source Serif 4). Tile and text colours come from the tokens (`tone="light"` is for use on the dark glow).
export function LogoMark({ size = 28, tone = "brand", className = "" }: { size?: number; tone?: "brand" | "light"; className?: string }) {
  return <span aria-hidden className={`inline-grid shrink-0 place-items-center rounded-tight font-serif leading-none ${tone === "light" ? "bg-white text-primary" : "bg-primary text-on-primary"} ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }}>LB</span>;
}
export default function Logo({ href, size = 28, tone = "brand", wordmark = true, compact = false, className = "" }: { href?: string; size?: number; tone?: "brand" | "light"; wordmark?: boolean; compact?: boolean; className?: string }) {
  const inner = <><LogoMark size={compact ? 24 : size} tone={tone} />{wordmark && <span className={`font-serif ${compact ? "text-fs-xl" : "text-fs-display"} leading-none tracking-brand ${tone === "light" ? "text-white" : "text-foreground"}`}>Lex<span className="font-serif-strong">Bharat</span></span>}</>;
  const cls = `inline-flex items-center gap-2 ${className}`;
  return href ? <Link href={href} aria-label="LexBharat" className={`${cls} rounded-tight focus-visible:outline-2 focus-visible:outline-primary`}>{inner}</Link> : <span className={cls} role="img" aria-label="LexBharat">{inner}</span>;
}
