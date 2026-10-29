import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHero, Section, SimpleTable, DataNote } from "@/components/ui";
import MockBadge from "@/components/MockBadge";
import { legalPages } from "@/data/legal";
import DevOnly from "@/components/DevOnly";

const idOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Renders one legal page from src/data/legal.ts: table of contents, numbered sections, and a "recreated" notice. */
export default function LegalView({ slug }: { slug: string }) {
  const p = legalPages.find((l) => l.slug === slug);
  if (!p) notFound();
  return (
    <>
      <PageHero eyebrow={`Last updated: ${p.updated} (placeholder date)`} title={p.title} lead={p.intro} />
      <Section>
        <DevOnly>
        <div className="mb-8 max-w-w860 rounded-panel border border-warning/40 bg-warning/10 p-4 text-fs-ui text-warning">
          <MockBadge>recreated placeholder</MockBadge>{" "}
          This page recreates the <strong>structure</strong> of a public legal page. Its wording is original placeholder text, not the real document, and has no legal effect. Do not rely on it.
        </div>
        </DevOnly>
        <div className="grid gap-10 lg:grid-cols-[240px_1fr] [&>*]:min-w-0">
          <nav aria-label="Contents" className="lg:sticky lg:top-header lg:self-start">
            <p className="mb-2 font-mono text-fs-nano uppercase tracking-wider text-muted">Contents</p>
            <ol className="space-y-1 text-fs-ui">
              {p.sections.map((s) => <li key={s.h}><a href={`#${idOf(s.h)}`} className="text-muted hover:text-primary">{s.h}</a></li>)}
            </ol>
            <p className="mt-6 text-fs-sm text-muted">Related: {p.related.map((r, i) => <span key={r.slug}>{i > 0 && ", "}<Link href={`/${r.slug}`} className="text-primary hover:underline">{r.label}</Link></span>)}</p>
          </nav>
          <article className="max-w-w760 space-y-8">
            {p.sections.map((s) => (
              <section key={s.h} id={idOf(s.h)} >
                <h2 className="text-fs-22 font-semibold tracking-tight">{s.h}</h2>
                {s.p.map((t, i) => <p key={i} className="mt-3 text-fs-lead leading-reading-loose text-foreground/90">{t}</p>)}
                {s.subs && (
                  <div className="mt-4 space-y-5 border-l-2 border-border pl-5">
                    {s.subs.map((x) => (
                      <div key={x.h}><h3 className="text-fs-17 font-semibold">{x.h}</h3><p className="mt-1 text-fs-body leading-reading text-muted">{x.p}</p></div>
                    ))}
                  </div>
                )}
                {s.list && <ul className="mt-3 list-disc space-y-1 pl-6 text-fs-lead">{s.list.map((x) => <li key={x}>{x}</li>)}</ul>}
                {s.table && <div className="mt-4"><SimpleTable head={s.table.head} rows={s.table.rows} /></div>}
              </section>
            ))}
            <p className="border-t border-border pt-4 text-fs-ui text-muted">Questions? See the contact details on <a href="https://lexbharat.ai" className="text-primary hover:underline" rel="noopener noreferrer">lexbharat.ai</a>.</p>
          </article>
        </div>
      </Section>
      <DataNote kind="placeholder" files={["src/data/legal.ts"]} />
    </>
  );
}
