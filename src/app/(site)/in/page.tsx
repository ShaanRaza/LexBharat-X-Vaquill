import type { Metadata } from "next";
import { PageHero, Section, Stat, SimpleTable, CtaBand, DataNote } from "@/components/ui";
import { indiaStats, indiaJurisdictions, indiaBodies } from "@/data/india";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `India legal data | ${BRAND_SUFFIX}` };

export default function India() {
  return (
    <>
      <PageHero
        eyebrow="India"
        title="Compliance and regulatory law data infrastructure, starting with India and the US."
        lead="Acts, rules, regulations, notifications, orders and judgments as structured, section-level data."
        actions={[{ label: "Book a demo", href: "/contact" }]}
      />
      <Section title="Union, state and regulator law, in one consistent format.">
        <div className="grid gap-8 sm:grid-cols-3">{indiaStats.map((s) => <Stat key={s.label} value={s.value} label={s.label} />)}</div>
        <p className="mt-6 max-w-w720 text-fs-lead leading-relaxed text-muted">Built from the Government of India's official repository plus statutory regulators' own sites (display copy; no dataset ships with this build).</p>
      </Section>
      <Section tone="accent" title="Jurisdictions" lead="A sample of the jurisdiction table printed on the public page (first 13 rows).">
        <SimpleTable head={["Jurisdiction", "Acts", "Sections"]} rows={indiaJurisdictions.map(([a, b, c]) => [a, b, c])} />
      </Section>
      <Section title="Government bodies watched for change" lead="Courts, tribunals and regulators named on the public page.">
        <ul className="flex flex-wrap gap-2">
          {indiaBodies.map((b) => <li key={b} className="rounded-full border border-border bg-surface px-3 py-1 text-fs-ui">{b}</li>)}
        </ul>
      </Section>
      <CtaBand title="Talk to us about India coverage." primary={{ label: "Contact", href: "/contact" }} />
      <DataNote kind="static" files={["src/data/india.ts"]} />
    </>
  );
}
