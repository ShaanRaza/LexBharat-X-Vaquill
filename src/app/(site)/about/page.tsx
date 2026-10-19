import type { Metadata } from "next";
import { PageHero, Section, CardGrid, Card, DataNote } from "@/components/ui";
import { team } from "@/data/company";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `About | ${BRAND_SUFFIX}` };

export default function About() {
  return (
    <>
      <PageHero eyebrow="About" title="Our story" lead="US primary law as clean, structured data: statutes, regulations, constitutions, court rules and executive orders through an API, an MCP server and an open dataset." />
      <Section title="Built for developers and companies">
        <div className="max-w-[760px] space-y-4 text-[17px] leading-[1.75] text-muted">
          <p>US primary law is public, yet it is not usable. It lives across thousands of government sources, in inconsistent formats, with no stable structure and no single API.</p>
          <p>The product covers the complete US Code, the CFR and state and territory codes: normalized, cross-referenced and citation-addressable. (Paraphrased from the public About page.)</p>
          <p>It serves LegalTech and RegTech products, AI teams, compliance platforms, universities and government.</p>
        </div>
      </Section>
      <Section tone="accent" title="Meet our founders" lead="Fictional placeholder profiles. No real individuals are described.">
        <CardGrid cols={2}>{team.map((p) => <Card key={p.name} title={p.name} tag={p.role}>{p.bio}</Card>)}</CardGrid>
      </Section>
      <DataNote kind="placeholder" files={["src/data/company.ts"]} />
    </>
  );
}
