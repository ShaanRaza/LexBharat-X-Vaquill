import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ConsoleShell from "@/components/console/ConsoleShell";
import { ALL_COURTS } from "@/data/workspaceBrowse";
import { getJudgmentsStore } from "@/lib/judgments";
import { WORKSPACE_SUFFIX } from "@/lib/release";

// Case detail. Route scheme (stable): /workspace/browse/judgments/<court-slug>/<year>/<caseId>?p=<100-case page>&lp=<list page>
// `p` locates a High Court case inside the exported pages (the Supreme Court ignores it); `lp` only restores the list page on "back".
// Metadata only: no judgment text exists in this product yet, and the page says so.
export const metadata: Metadata = { title: `Case | ${WORKSPACE_SUFFIX}`, robots: { index: false, follow: false } };

export default async function CasePage({ params, searchParams }: { params: Promise<{ court: string; year: string; caseId: string }>; searchParams: Promise<{ p?: string; lp?: string }> }) {
  const { court: slug, year: yearParam, caseId: rawId } = await params, { p, lp } = await searchParams;
  const court = ALL_COURTS.find((c) => c.slug === slug), year = Number(yearParam), caseId = decodeURIComponent(rawId);
  if (!court || !Number.isInteger(year)) notFound();
  const store = getJudgmentsStore();
  const c = await store.get(slug, year, caseId, p ? Math.floor(Number(p)) || undefined : undefined);
  const stats = await store.stats();
  const back = `/workspace/browse/judgments/${slug}?year=${year}${lp && Number(lp) > 1 ? `&page=${Math.floor(Number(lp))}` : ""}`;
  const crumbs = (
    <nav aria-label="Breadcrumb" className="text-[14px] text-[#535151]">
      <Link href="/workspace/browse" className="inline-flex min-h-8 items-center hover:text-primary hover:underline">Browse Laws &amp; Judgments</Link><span aria-hidden> / </span>
      <Link href={`/workspace/browse/judgments/${slug}`} className="hover:text-primary hover:underline">{court.name}</Link><span aria-hidden> / </span>
      <Link href={back} className="hover:text-primary hover:underline">{year}</Link>
    </nav>
  );
  if (!c) notFound(); // a real 404: the link does not match a case in the exported list (see the route scheme above)
  const rows: [string, React.ReactNode][] = [
    ["Court", court.name],
    ["Decision date", c.decisionDate ? c.decisionDate.slice(0, 10) : `Not recorded (listed under ${year} from the record's year)`],
    ["Case number", c.caseNumber ?? "Not recorded"],
    ["Reporter citation", c.citation ?? "No reporter citation is available for this record"],
    ["Disposition", c.dispositionLabel && c.disposition && c.dispositionLabel.toLowerCase() !== c.disposition.toLowerCase() ? `${c.dispositionLabel} (as recorded: ${c.disposition})` : (c.dispositionLabel ?? c.disposition ?? "Not recorded")],
    ["Petitioner", c.petitioner ?? "Not recorded"],
    ["Respondent", c.respondent ?? "Not recorded"],
    ...(c.judges?.length ? ([[slug === "supreme-court-of-india" ? "Judges (as listed in the source)" : "Judges", c.judges.join(", ")]] as [string, React.ReactNode][]) : []),
    // Supreme Court bench strength is not shown: the source lists the authoring judge for most cases (87% "single"), so it understates real benches.
    ...(c.benchSize ? ([["Bench", c.benchSize === 1 ? "Single judge" : c.benchSize === 2 ? "Division bench" : `${c.benchSize}-judge bench`]] as [string, React.ReactNode][]) : []),
    ...(c.pages ? ([["Pages (extracted text)", String(c.pages)]] as [string, React.ReactNode][]) : []),
    ...(c.dateOfRegistration ? ([["Registered (as recorded)", c.dateOfRegistration]] as [string, React.ReactNode][]) : []),
    ["Record ID", <span key="id" className="font-mono">{c.caseId}</span>],
  ];
  return (
    <ConsoleShell variant="workspace">
      <div className="mx-auto max-w-[880px] pt-2">
        {crumbs}
        <h1 className="mt-2 text-[24px] font-semibold leading-snug tracking-[-0.02em]">{c.title ?? (c.caseNumber ? `Case ${c.caseNumber}` : `Case record ${c.caseId}`)}</h1>
        <p className="mt-1 text-[15px] text-[#535151]">{court.name} · {year}</p>
        <dl className="mt-5 divide-y divide-border/60 rounded-xl bg-surface shadow-sm ring-1 ring-border/60">
          {rows.map(([k, v]) => (<div key={k} className="grid gap-1 px-5 py-3 sm:grid-cols-[200px_1fr]"><dt className="text-[13px] text-[#535151]">{k}</dt><dd className="text-[15px]">{v}</dd></div>))}
        </dl>
        <p className="mt-4 rounded-lg bg-accent px-4 py-2.5 text-[13px] text-[#535151]">This page shows case metadata only. The judgment text is not available in LexBharat yet. Party names are as extracted from the judgment and can be incomplete.</p>
        <Link href={back} className="mt-4 inline-flex h-9 items-center rounded-lg px-3 text-[14px] ring-1 ring-border hover:bg-accent">← Back to {year} cases</Link>
        {stats.attribution && <p className="mt-6 text-[12px] text-muted">{stats.attribution.text} Licence: {stats.attribution.licence}, snapshot {stats.attribution.snapshot}. <a href={stats.attribution.url} className="underline" rel="noopener noreferrer" target="_blank">Dataset</a></p>}
      </div>
    </ConsoleShell>
  );
}
