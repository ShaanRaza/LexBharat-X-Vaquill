import { PageHero, Section, DataNote } from "./ui";
import MockBadge from "./MockBadge";
import type { Structured } from "@/data/extraPages";
import DevOnly from "@/components/DevOnly";

const id = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Page recreated from a public page's outline: headings and order are observed, text is placeholder. */
export default function StructuredPage({ page, dataFile }: { page: Structured; dataFile: string }) {
  return (
    <>
      <PageHero eyebrow={page.eyebrow} title={page.title} lead={page.lead} />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[220px_1fr] [&>*]:min-w-0">
          <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">On this page</p>
            <ul className="space-y-1 text-[14px]">
              {page.sections.map((s) => <li key={s.h}><a href={`#${id(s.h)}`} className="text-muted hover:text-primary">{s.h}</a></li>)}
              {page.faq && <li><a href="#faq" className="text-muted hover:text-primary">Frequently asked questions</a></li>}
            </ul>
          </nav>
          <div className="max-w-[760px] space-y-10">
            <DevOnly><p className="text-[13px] text-muted"><MockBadge>recreated placeholder</MockBadge> Heading order observed on the public page; wording is original placeholder text.</p></DevOnly>
            {page.sections.map((s) => (
              <section key={s.h} id={id(s.h)} className="scroll-mt-24">
                <h2 className="text-[26px] font-semibold tracking-[-0.02em]">{s.h}</h2>
                {s.text && <p className="mt-3 text-[16px] leading-[1.75] text-muted">{s.text}</p>}
                {s.sub && (
                  <div className="mt-4 space-y-4">
                    {s.sub.map((x) => (
                      <div key={x} className="rounded-panel border border-border bg-surface p-4">
                        <h3 className="text-[17px] font-semibold">{x}</h3>
                        <p className="mt-1 text-[15px] leading-relaxed text-muted">Placeholder description for “{x}”.</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
            {page.faq && (
              <section id="faq" className="scroll-mt-24">
                <h2 className="text-[26px] font-semibold tracking-[-0.02em]">Frequently asked questions</h2>
                <dl className="mt-4 divide-y divide-border border-y border-border">
                  {page.faq.map(([q, a]) => <div key={q} className="py-4"><dt className="font-semibold">{q}</dt><dd className="mt-1 text-[15px] text-muted">{a}</dd></div>)}
                </dl>
              </section>
            )}
          </div>
        </div>
      </Section>
      <DataNote kind="placeholder" files={[dataFile]} />
    </>
  );
}
