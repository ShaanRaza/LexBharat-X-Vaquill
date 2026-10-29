import Link from "next/link";

// Numbered citation chip ([1], [2]...) that links to the cited source. Shared: any page that cites a source uses this one. Colours and sizes come from the tokens.
// kind="act" (default) is a section of an Act; kind="judgment" is an excerpt of a Supreme Court judgment (neutral chip, solid outline); kind="doc" is a passage of the user's own document, drawn differently (info colour, dashed outline) so the two are never confused.
const KIND = {
  act: "bg-primary/10 text-primary ring-1 ring-primary/25 hover:bg-primary/20",
  doc: "bg-quality-info/10 text-quality-info outline outline-1 outline-dashed outline-quality-info/60 hover:bg-quality-info/20",
  judgment: "bg-accent text-foreground ring-1 ring-foreground/30 hover:bg-accent/60",
} as const;
// With onSelect the chip is a button that selects the source (the Ask reading desk shows the cited page beside the answer); `active` marks the selected one. Without it, it is a link to the source.
export default function CitationChip({ n, href, label, kind = "act", onSelect, active = false, shown }: { n: number; href: string; label: string; kind?: keyof typeof KIND; onSelect?: (n: number) => void; active?: boolean; /** the number to print when it differs from the stored one (an answer shows its citations 1, 2, 3... in order of use) */ shown?: number }) {
  const cls = `mx-0.5 inline-flex min-w-5 items-center justify-center rounded-chip px-1.5 align-baseline font-mono text-ui-xs font-medium ${KIND[kind]}${active ? " ring-2 ring-primary" : ""}`, aria = `${kind === "doc" ? "Your document" : kind === "judgment" ? "Judgment" : "Source"} ${shown ?? n}: ${label}`;
  if (onSelect) return <button type="button" onClick={() => onSelect(n)} title={label} aria-label={aria} aria-pressed={active} className={cls}>{shown ?? n}</button>;
  return (
    <Link href={href} title={label} aria-label={aria} className={cls}>{shown ?? n}</Link>
  );
}
