import Link from "next/link";

// Numbered citation chip ([1], [2]...) that links to the cited source. Shared: any page that cites a source uses this one. Colours and sizes come from the tokens.
export default function CitationChip({ n, href, label }: { n: number; href: string; label: string }) {
  return (
    <Link href={href} title={label} aria-label={`Source ${n}: ${label}`}
      className="mx-0.5 inline-flex min-w-5 items-center justify-center rounded-chip bg-primary/10 px-1.5 align-baseline text-ui-xs font-medium text-primary ring-1 ring-primary/25 hover:bg-primary/20">{n}</Link>
  );
}
