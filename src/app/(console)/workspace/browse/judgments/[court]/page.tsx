import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ConsoleShell from "@/components/console/ConsoleShell";
import { ALL_COURTS, decades } from "@/data/workspaceBrowse";
import { BRAND_SUFFIX } from "@/lib/release";

export function generateStaticParams() { return ALL_COURTS.map((c) => ({ court: c.slug })); }
export const dynamicParams = false;
export async function generateMetadata({ params }: { params: Promise<{ court: string }> }): Promise<Metadata> {
  const { court: slug } = await params;
  const c = ALL_COURTS.find((x) => x.slug === slug);
  return { title: `${c?.name ?? "Court"} judgments | ${BRAND_SUFFIX} (local mock)`, robots: { index: false, follow: false } };
}

// Year picker for one court. The year cards are PLACEHOLDERS: no judgments are held or served here.
export default async function CourtPage({ params }: { params: Promise<{ court: string }> }) {
  const { court: slug } = await params;
  const court = ALL_COURTS.find((x) => x.slug === slug);
  if (!court) notFound();
  return (
    <ConsoleShell variant="workspace">
      <div className="mx-auto max-w-[880px] pt-2">
        <nav aria-label="Breadcrumb" className="text-[14px] text-[#535151]"><Link href="/workspace/browse" className="inline-flex min-h-8 items-center hover:text-primary hover:underline">Browse Laws &amp; Judgments</Link><span aria-hidden> / </span><span>{court.name}</span></nav>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">{court.name}</h1>
        <p className="mt-1 text-[15px] text-[#535151]">{court.count ? `${court.count} judgments in the reference app.` : "Judgment count not captured."} Choose a year.</p>
        <p className="mt-3 rounded-lg bg-accent px-4 py-2.5 text-[13px] text-[#535151]">Placeholder page: the years below are not wired to any judgments, and this clone serves no case law.</p>
        <div className="mt-6 space-y-7">
          {decades().map((d) => (
            <section key={d.label} aria-label={d.label}>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#535151]">{d.label}</h2>
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {d.years.map((y) => (
                  <li key={y}><button type="button" aria-disabled="true" title="Placeholder: no judgments in this clone" className="flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-surface text-[15px] shadow-sm ring-1 ring-border/60 hover:bg-accent/60">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>{y}</button></li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </ConsoleShell>
  );
}
