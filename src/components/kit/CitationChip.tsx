import Link from "next/link";

// Numbered citation chip ([1], [2]...) that links to the cited source. Shared: any page that cites a source uses this one. Colours and sizes come from the tokens.
// kind="act" (default) is a section of an Act; kind="judgment" is an excerpt of a Supreme Court judgment (neutral chip, solid outline); kind="doc" is a passage of the user's own document, drawn differently (info colour, dashed outline) so the two are never confused.
const KIND = {
  act: "bg-primary/10 text-primary ring-1 ring-primary/25 hover:bg-primary/20",
  doc: "bg-quality-info/10 text-quality-info outline outline-1 outline-dashed outline-quality-info/60 hover:bg-quality-info/20",
  judgment: "bg-accent text-foreground ring-1 ring-foreground/30 hover:bg-accent/60",
} as const;
export default function CitationChip({ n, href, label, kind = "act" }: { n: number; href: string; label: string; kind?: keyof typeof KIND }) {
  return (
    <Link href={href} title={label} aria-label={`${kind === "doc" ? "Your document" : kind === "judgment" ? "Judgment" : "Source"} ${n}: ${label}`}
      className={`mx-0.5 inline-flex min-w-5 items-center justify-center rounded-chip px-1.5 align-baseline text-ui-xs font-medium ${KIND[kind]}`}>{n}</Link>
  );
}
