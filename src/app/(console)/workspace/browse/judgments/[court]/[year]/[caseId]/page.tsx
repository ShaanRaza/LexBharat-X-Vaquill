import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ConsoleShell from "@/components/console/ConsoleShell";
import CopyButton from "@/components/workspace/CopyButton";
import { ALL_COURTS } from "@/data/workspaceBrowse";
import { getJudgmentsStore } from "@/lib/judgments";
import { JUDGE_COURTS, SC_SLUG, provenanceRows } from "@/lib/judgments/provenance";
import { WORKSPACE_SUFFIX } from "@/lib/release";

// Case detail. Route scheme (stable): /workspace/browse/judgments/<court-slug>/<year>/<caseId>?p=<100-case page>&lp=<list page>
// `p` locates a High Court case inside the exported pages (the Supreme Court ignores it); `lp` only restores the list page on "back".
// Metadata and, for the Supreme Court, a short opening text. The page lists which fields exist and which are absent, and why (provenance panel).
export const metadata: Metadata = { title: `Case | ${WORKSPACE_SUFFIX}`, robots: { index: false, follow: false } };

const longDate = (d?: string) => (d ? new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null);

export default async function CasePage({ params, searchParams }: { params: Promise<{ court: string; year: string; caseId: string }>; searchParams: Promise<{ p?: string; lp?: string }> }) {
  const { court: slug, year: yearParam, caseId: rawId } = await params, { p, lp } = await searchParams;
  const court = ALL_COURTS.find((c) => c.slug === slug), year = Number(yearParam), caseId = decodeURIComponent(rawId);
  if (!court || !Number.isInteger(year)) notFound();
  const store = getJudgmentsStore(), sc = slug === SC_SLUG;
  const c = await store.get(slug, year, caseId, p ? Math.floor(Number(p)) || undefined : undefined);
  if (!c) notFound(); // a real 404: the link does not match a case in the exported list (see the route scheme above)
  const [stats, preview] = await Promise.all([store.stats(), sc ? store.preview(slug, year, caseId) : Promise.resolve(null)]);
  const back = `/workspace/browse/judgments/${slug}?year=${year}${lp && Number(lp) > 1 ? `&page=${Math.floor(Number(lp))}` : ""}`;
  const parties = c.petitioner && c.respondent ? `${c.petitioner} v. ${c.respondent}` : null;
  const heading = parties ?? c.title ?? (c.caseNumber ? `Case ${c.caseNumber}` : `Case record ${c.caseId}`);
  const date = longDate(c.decisionDate);
  const benchN = c.benchExtracted?.length ?? c.benchSize;
  const benchWord = (n: number) => (n === 1 ? "Single judge" : n === 2 ? "Division bench" : `${n}-judge bench`);
  // Best identifier to copy: the Supreme Court citation; otherwise the case number with court and date. Never an invented citation.
  const ref = c.citation ?? `${c.caseNumber ? `Case no. ${c.caseNumber}` : `Record ${c.caseId}`}, ${court.name}${date ? ` (decided ${date})` : `, ${year}`}`;
  const chip = "rounded-md bg-accent px-2 py-0.5";
  const rows: [string, React.ReactNode][] = [
    ["Court", court.name],
    ["Decision date", date ?? `Not recorded (listed under ${year} from the record's year)`],
    ...(sc ? ([["Citation", c.citation ? <span key="c" className="inline-flex items-center gap-2"><code className="font-mono">{c.citation}</code><CopyButton text={c.citation} label="Copy citation" /></span> : "No citation recorded for this case"]] as [string, React.ReactNode][])
           : ([["Reporter citation", "None in this dataset for High Courts. Cite by case number."], ["Case number", c.caseNumber ?? "Not recorded"]] as [string, React.ReactNode][])),
    ...(sc ? ([["Case number", c.caseNumberExtracted ? <span key="cn">{c.caseNumberExtracted} <span className="text-[12px] text-muted">◐ extracted from the report heading; the dataset has no Supreme Court case numbers</span></span> : "Not in the dataset, and not found in a clean form in the report heading"]] as [string, React.ReactNode][]) : []),
    ...(c.benchExtracted?.length ? ([["Full bench (extracted)", <span key="fb">{c.benchExtracted.join(", ")} <span className="text-[12px] text-muted">◐ {c.benchExtracted.length} {c.benchExtracted.length === 1 ? "judge" : "judges"}, extracted from the report heading</span></span>]] as [string, React.ReactNode][]) : []),
    ["Disposition", c.dispositionLabel && c.disposition && c.dispositionLabel.toLowerCase() !== c.disposition.toLowerCase() ? `${c.dispositionLabel} (as recorded: ${c.disposition})` : (c.dispositionLabel ?? c.disposition ?? "Not recorded")],
    ...(c.title && c.title !== heading ? ([["Case reference (as titled)", c.title]] as [string, React.ReactNode][]) : []),
    ...(c.judges?.length ? ([[sc ? "Authoring judge (as listed in the source)" : "Judges", c.judges.join(", ")]] as [string, React.ReactNode][]) : []),
    ...(!sc && c.benchSize ? ([["Bench", benchWord(c.benchSize)]] as [string, React.ReactNode][]) : []),
    ...(c.pages ? ([["Pages (extracted text)", String(c.pages)]] as [string, React.ReactNode][]) : []),
    ...(c.dateOfRegistration ? ([["Registered (as recorded)", c.dateOfRegistration]] as [string, React.ReactNode][]) : []),
    ["Record ID", <span key="id" className="font-mono">{c.caseId}</span>],
  ];
  const prov = provenanceRows(slug, { parties: !!parties, judges: !!c.judges?.length, bench: !!benchN, benchExtracted: !!c.benchExtracted?.length, caseNumberExtracted: !!c.caseNumberExtracted, pages: !!c.pages, preview: !!preview, citation: !!c.citation, caseNumber: !!c.caseNumber, disposition: !!(c.disposition || c.dispositionLabel), date: !!c.decisionDate });
  const mark = { shown: "✓", partly: "◐", absent: "–" } as const;
  return (
    <ConsoleShell variant="workspace">
      <div className="mx-auto max-w-[880px] pt-2">
        <nav aria-label="Breadcrumb" className="text-[14px] text-[#535151]">
          <Link href="/workspace/browse" className="inline-flex min-h-8 items-center hover:text-primary hover:underline">Browse Laws &amp; Judgments</Link><span aria-hidden> / </span>
          <Link href={`/workspace/browse/judgments/${slug}`} className="hover:text-primary hover:underline">{court.name}</Link><span aria-hidden> / </span>
          <Link href={back} className="hover:text-primary hover:underline">{year}</Link>
        </nav>
        <h1 className="mt-2 text-[24px] font-semibold leading-snug tracking-[-0.02em]">{heading}</h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[14px] text-[#535151]">
          <span>{court.name}</span>
          {c.citation ? <><span aria-hidden>·</span><code className="font-mono text-foreground">{c.citation}</code></> : c.caseNumber ? <><span aria-hidden>·</span><span>Case no. {c.caseNumber}</span></> : null}
          {sc && c.caseNumberExtracted ? <><span aria-hidden>·</span><span title="Extracted from the report heading">{c.caseNumberExtracted} ◐</span></> : null}
          <span aria-hidden>·</span><span>{date ?? year}</span>
        </p>
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-[#535151]">
          {(c.dispositionLabel ?? (sc ? c.disposition : undefined)) && <span className={chip}>{c.dispositionLabel ?? c.disposition}</span>}
          {benchN ? <span className={chip} title={c.benchExtracted?.length ? "Counted from the bench extracted from the report heading" : undefined}>{benchWord(benchN)}{c.benchExtracted?.length ? " (extracted)" : ""}</span> : null}
          {c.pages ? <span className={chip}>{c.pages} {c.pages === 1 ? "page" : "pages"}</span> : null}
          <CopyButton text={ref} label={c.citation ? "Copy citation" : "Copy case reference"} className="!text-[12px] !px-2 !py-0.5" />
          <span className="text-[12px] text-muted">{c.citation ? "Copies the citation" : "Copies the case number with court and date"}</span>
        </p>
        <dl className="mt-5 divide-y divide-border/60 rounded-xl bg-surface shadow-sm ring-1 ring-border/60">
          {rows.map(([k, v]) => (<div key={k} className="grid gap-1 px-5 py-3 sm:grid-cols-[210px_1fr]"><dt className="text-[13px] text-[#535151]">{k}</dt><dd className="text-[15px]">{v}</dd></div>))}
        </dl>
        {preview && (
          <section aria-labelledby="preview" className="mt-5 rounded-xl bg-surface p-5 shadow-sm ring-1 ring-border/60">
            <h2 id="preview" className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#535151]">Opening text (as extracted)</h2>
            <p className="mt-2 text-[15px] leading-relaxed">{preview}…</p>
            <p className="mt-2 text-[12px] text-muted">The first part of the English report, usually the headnote. OCR errors are possible. The full judgment text is not available in LexBharat.</p>
          </section>
        )}
        <section aria-labelledby="prov" className="mt-5 rounded-xl bg-accent/50 p-5 ring-1 ring-border/50">
          <h2 id="prov" className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#535151]">Where each field comes from</h2>
          <p className="mt-1 text-[13px] text-[#535151]">All data is from the open-india-law dataset ({stats.attribution?.licence}, snapshot {stats.attribution?.snapshot}). ✓ as recorded, ◐ present but imperfect, – absent, with the reason.</p>
          <ul className="mt-3 space-y-1.5 text-[13px]">
            {prov.map((r) => (<li key={r.field} className="grid grid-cols-[18px_130px_1fr] gap-x-2"><span aria-hidden className="text-muted">{mark[r.state]}</span><span className="font-medium">{r.field}</span><span className="text-[#535151]">{r.note}</span></li>))}
          </ul>
          {JUDGE_COURTS.includes(slug) && <p className="mt-2 text-[12px] text-muted">Judges and bench are exported only for Bombay, Gujarat and Orissa.</p>}
        </section>
        <Link href={back} className="mt-4 inline-flex h-9 items-center rounded-lg px-3 text-[14px] ring-1 ring-border hover:bg-accent">← Back to {year} cases</Link>
        {stats.attribution && <p className="mt-6 text-[12px] text-muted">{stats.attribution.text} Licence: {stats.attribution.licence}, snapshot {stats.attribution.snapshot}. <a href={stats.attribution.url} className="underline" rel="noopener noreferrer" target="_blank">Dataset</a> Verify against the official source before relying on it; this is not legal advice.</p>}
      </div>
    </ConsoleShell>
  );
}
