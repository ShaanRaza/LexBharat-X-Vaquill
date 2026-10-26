"use client";
import Link from "next/link";
import CopyButton from "./CopyButton";
import type { CaseItem } from "@/lib/judgments/types";

// One case in any list (court-year list, search results). Metadata only; what shows depends on what the export verified for that court (docs/JUDGMENTS-HC.md).
const fmtDate = (d?: string) => (d ? new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null);
export const benchLabel = (n: number) => (n === 1 ? "Single judge" : n === 2 ? "Division bench" : `${n}-judge bench`);

/** Headline = the case reference ("WP/933/2024"), parties line = "A v. B". Many titles already read "WP/933/2024 of A Vs B": then the reference is cut out of the title so the parties are not printed twice. */
export function heads(c: CaseItem): { heading: string; parties: string | null } {
  const parties = c.petitioner && c.respondent ? `${c.petitioner} v. ${c.respondent}` : null;
  let heading = c.title ?? "";
  if (parties) {
    const cut = heading.indexOf(" of ");
    if (cut > 0 && cut <= 40 && c.petitioner && heading.toLowerCase().includes(c.petitioner.slice(0, 10).toLowerCase())) heading = heading.slice(0, cut);
    else if (c.petitioner && heading.toLowerCase().includes(c.petitioner.slice(0, 10).toLowerCase())) return { heading, parties: null };
  }
  if (!heading) heading = c.caseNumber ? `Case ${c.caseNumber}` : `Case record ${c.caseId}`;
  else if (/^\d+\s*(of|\/)\s*\d{4}$/i.test(heading)) heading = `Case ${heading}`;
  return { heading, parties };
}

export default function CaseRow({ c, href, court, courtName, year }: { c: CaseItem; href: string; court: string; courtName?: string; year?: number }) {
  const { heading, parties } = heads(c), date = fmtDate(c.decisionDate), chip = "rounded-chip bg-accent px-2 py-0.5";
  return (
    <li className="relative rounded-card bg-surface px-5 py-4 shadow-sm ring-1 ring-border/60 transition-colors hover:ring-primary/50">
      {/* the title link stretches over the whole row; the copy button sits above it */}
      <Link href={href} className="text-fs-body font-medium text-primary after:absolute after:inset-0 after:rounded-xl after:content-['']">{heading}</Link>
      {parties && <p className="mt-1 text-fs-ui text-foreground/80">{parties}</p>}
      {c.benchExtracted?.length ? <p className="mt-1.5 flex flex-wrap gap-1" title="Bench from the judgment text">{c.benchExtracted.map((j) => <span key={j} className="rounded-chip bg-accent px-2 py-0.5 text-fs-xs text-foreground/80">{j}</span>)}</p>
        : c.judges?.length ? <p className="mt-1 text-fs-sm italic text-secondary">{court === "supreme-court-of-india" ? "Authoring judge: " : ""}{c.judges.join(", ")}</p> : null}
      <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-fs-xs text-secondary">
        {(courtName || year) && <span className={`${chip} font-medium text-foreground/80`}>{courtName}{courtName && year ? " · " : ""}{year}</span>}
        <span className={chip}>{date ?? "No decision date recorded"}</span>
        {c.citation && <span className="relative z-10 inline-flex items-center gap-1.5"><code className="font-mono text-fs-xs text-foreground">{c.citation}</code><CopyButton text={c.citation} label="Copy citation" /></span>}
        {(c.dispositionLabel ?? (court === "supreme-court-of-india" ? c.disposition : undefined)) && <span className={chip}>{c.dispositionLabel ?? c.disposition}</span>}
        {c.benchExtracted?.length ? <span className={chip} title="Counted from the bench read from the judgment text">{benchLabel(c.benchExtracted.length)} ◐</span> : c.benchSize ? <span className={chip}>{benchLabel(c.benchSize)}</span> : null}
        {c.caseNumber ? <span>Case no. {c.caseNumber}</span> : c.caseNumberExtracted ? <span title="From the judgment text">{c.caseNumberExtracted} ◐</span> : null}
        {c.pages ? <span>· {c.pages} {c.pages === 1 ? "page" : "pages"}</span> : null}
        <span className="font-mono">· {c.caseId}</span>
      </p>
    </li>
  );
}
