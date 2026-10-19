import type { Metadata } from "next";
import { PageHero, Section, CardGrid, Card, Stat, SimpleTable, DataNote } from "@/components/ui";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Open US Law dataset | ${BRAND_SUFFIX}` };

const fields: [string, string][] = [
  ["act_id", "Stable identifier for a section"],
  ["citation", "Human-readable citation"],
  ["hierarchy", "Where the section sits in its code"],
  ["act_status", "In force / repealed"],
  ["source_url", "Link to the official publisher"],
];

export default function OpenLaw() {
  return (
    <>
      <PageHero
        eyebrow="Open data"
        title="Open US Law"
        lead="A free, machine-readable snapshot of United States primary law: statutory codes, constitutions, regulations, court rules and agency material."
        actions={[{ label: "Get the dataset (placeholder)", href: "#", disabled: true }, { label: "View the scrapers (placeholder)", href: "#", variant: "secondary", disabled: true }]}
      />
      <Section title="By the numbers" lead="Figures below are placeholders shaped like the public page's summary tiles.">
        <div className="grid gap-8 sm:grid-cols-3"><Stat value="5.4M+" label="Total sections" /><Stat value="56" label="Jurisdictions" /><Stat value="308" label="Files in the snapshot" /></div>
      </Section>
      <Section tone="accent" title="What is in the dataset" lead="A small slice of the schema, as listed on the public page.">
        <SimpleTable head={["Field", "Meaning"]} rows={fields.map(([f, m]) => [<code key="f" className="font-mono text-[12.5px]">{f}</code>, m])} />
      </Section>
      <Section title="Access the data" lead="The real site links to a hosted dataset, a code repository and a file mirror. Here those links are inert on purpose.">
        <CardGrid>
          <Card title="Hosted dataset" tag="placeholder">Canonical copy in a columnar file format.</Card>
          <Card title="Scrapers" tag="placeholder">The open-source code that builds the dataset.</Card>
          <Card title="Combined archive" tag="placeholder">All jurisdictions in one large file, plus a machine-readable manifest.</Card>
        </CardGrid>
      </Section>
      <Section tone="accent" title="Licensing: three layers, each licensed separately">
        <CardGrid>
          <Card title="Statutory text: public domain">Government edicts are not copyrightable; no rights are asserted over the text.</Card>
          <Card title="Compilation and structuring: non-commercial license">Schema, citations, hierarchy and assembly: free for research and non-commercial use.</Card>
          <Card title="Scrapers: permissive code license">The collection code is released under a permissive open-source license.</Card>
        </CardGrid>
      </Section>
      <DataNote kind="placeholder" files={["src/app/(site)/open-us-law/page.tsx"]} />
    </>
  );
}
