import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BrowseShell from "@/components/console/BrowseShell";
import { ALL_COURTS, decades } from "@/data/workspaceBrowse";
import CaseList from "@/components/workspace/CaseList";
import CourtSearch from "@/components/workspace/CourtSearch";
import { getJudgmentsStore } from "@/lib/judgments";
import { WORKSPACE_SUFFIX } from "@/lib/release";

export function generateStaticParams() { return ALL_COURTS.map((c) => ({ court: c.slug })); }
export const dynamicParams = false;
export async function generateMetadata({ params }: { params: Promise<{ court: string }> }): Promise<Metadata> {
  const { court: slug } = await params;
  const c = ALL_COURTS.find((x) => x.slug === slug);
  return { title: `${c?.name ?? "Court"} judgments | ${WORKSPACE_SUFFIX}`, robots: { index: false, follow: false } };
}

// Court page: year picker with real case-record counts (Phase 2). Supreme Court years open a case-metadata list; High Courts show counts only
// (case lists are not published yet). With JUDGMENTS_SOURCE=mock the old placeholder year grid is shown instead. No judgment text anywhere.
export default async function CourtPage({ params, searchParams }: { params: Promise<{ court: string }>; searchParams: Promise<{ year?: string; page?: string }> }) {
  const { court: slug } = await params, { year: yearParam, page: pageParam } = await searchParams;
  const court = ALL_COURTS.find((x) => x.slug === slug);
  if (!court) notFound();
  const store = getJudgmentsStore(), real = store.source === "real";
  const summary = (await store.courts()).find((c) => c.slug === slug), years = (await store.years(slug)) ?? [], stats = await store.stats();
  const year = Number(yearParam), picked = real && summary?.listable && Number.isInteger(year) && years.some((y) => y.year === year) ? year : null;
  const groups = new Map<number, typeof years>();
  for (const y of years) { const d = Math.floor(y.year / 10) * 10; groups.set(d, [...(groups.get(d) ?? []), y]); }
  const decadeList = [...groups.entries()].sort((a, b) => b[0] - a[0]);
  const fmt = (n: number) => n.toLocaleString("en-IN");
  // case records the dataset holds but cannot place in a year (no decision date and no year): counted in the court total, listed under no year
  const noYear = real && summary?.cases != null && years.length ? Math.max(0, summary.cases - years.reduce((a, y) => a + (y.cases ?? 0), 0)) : 0;
  return (
    <BrowseShell>
      <div className="mx-auto max-w-content pt-2">
        <nav aria-label="Breadcrumb" className="text-fs-ui text-secondary"><Link href="/workspace/browse" className="inline-flex min-h-8 items-center hover:text-primary hover:underline">Browse Laws &amp; Judgments</Link><span aria-hidden> / </span>
          {picked ? <><Link href={`/workspace/browse/judgments/${slug}`} className="hover:text-primary hover:underline">{court.name}</Link><span aria-hidden> / </span><span>{picked}</span></> : <span>{court.name}</span>}</nav>
        <h1 className="mt-2 text-fs-title font-semibold tracking-tight">{court.name}{picked ? ` · ${picked}` : ""}</h1>
        {real ? (
          <p className="mt-1 text-fs-body text-secondary">{summary?.cases != null ? `${fmt(summary.cases)} case records` : "Case count unavailable"}{summary?.firstYear ? `, ${summary.firstYear} to ${summary.lastYear}` : ""}. {picked ? "Case metadata only; judgment text is not available yet." : "Choose a year."}</p>
        ) : (
          <>
            <p className="mt-1 text-fs-body text-secondary">{court.count ? `${court.count} judgments in the reference app.` : "Judgment count not captured."} Choose a year.</p>
            <p className="mt-3 rounded-field bg-accent px-4 py-2.5 text-fs-sm text-secondary">Placeholder page: the years below are not wired to any judgments.</p>
          </>
        )}
        {noYear > 0 && <p className="mt-3 rounded-field bg-accent px-4 py-2.5 text-fs-sm text-secondary" role="note">{fmt(noYear)} {noYear === 1 ? "case" : "cases"} without a year {noYear === 1 ? "is" : "are"} not listed.</p>}
        {real && !summary?.listable && <p className="mt-3 rounded-field bg-accent px-4 py-2.5 text-fs-sm text-secondary">Counts by year only. Case lists for this court are not available yet.</p>}
        {picked ? <CaseList court={slug} year={picked} courtName={court.name} searchable={!!summary?.searchable} filterable={!!summary?.filterable} years={years.map((y) => y.year)} initialPage={Math.max(1, Math.floor(Number(pageParam)) || 1)} /> : (
          <>
          {summary?.searchable && <CourtSearch court={slug} courtName={court.name} isSupreme={slug === "supreme-court-of-india"} />}
          <div className="mt-6 space-y-7">
            {(real ? decadeList.map(([d, ys]) => ({ label: `${d}s`, years: ys })) : decades().map((d) => ({ label: d.label, years: d.years.map((y) => ({ year: y, cases: null as number | null })) }))).map((d) => (
              <section key={d.label} aria-label={d.label}>
                <h2 className="text-fs-sm font-semibold uppercase tracking-caps text-secondary">{d.label}</h2>
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                  {d.years.map((y) => {
                    const inner = <><span>{y.year}</span>{y.cases != null && <span className="text-fs-xs text-secondary">{fmt(y.cases)}</span>}</>;
                    const cls = "flex h-12 w-full items-center justify-center gap-2 rounded-card bg-surface text-fs-body shadow-sm ring-1 ring-border/60";
                    return <li key={y.year}>{real && summary?.listable ? <Link href={`/workspace/browse/judgments/${slug}?year=${y.year}`} className={`${cls} hover:ring-primary/50`}>{inner}</Link>
                      : <span aria-disabled="true" className={`${cls} ${real ? "" : "cursor-not-allowed"}`} title={real ? "Counts only" : "Placeholder: no judgments"}>{inner}</span>}</li>;
                  })}
                </ul>
              </section>
            ))}
          </div>
          </>
        )}
        {real && stats.attribution && <div className="mt-8 space-y-1 text-fs-xs text-muted"><p>{stats.attribution.text} Licence: {stats.attribution.licence}, snapshot {stats.attribution.snapshot}. <a href={stats.attribution.url} className="underline" rel="noopener noreferrer" target="_blank">Dataset</a></p>{stats.caveats.map((c) => <p key={c}>{c}</p>)}</div>}
      </div>
    </BrowseShell>
  );
}
