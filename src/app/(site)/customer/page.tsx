import type { Metadata } from "next";
import { PageHero, Section, CardGrid, Card, CtaBand, DataNote } from "@/components/ui";
import { customers } from "@/data/company";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Customer stories | ${BRAND_SUFFIX}` };

export default function Customers() {
  return (
    <>
      <PageHero eyebrow="Customers" title="Customer stories" lead="How teams use the API. All stories here are fictional placeholders." />
      <Section>
        <CardGrid cols={2}>
          {customers.map((c) => <Card as="h2" key={c.slug} href={`/customer/${c.slug}`} tag={c.tag} title={c.title}>{c.summary}</Card>)}
        </CardGrid>
      </Section>
      <CtaBand title="Put real US law behind your product." primary={{ label: "Build on the API", href: "/legal-api" }} secondary={{ label: "Read the docs", href: "/docs" }} />
      <DataNote kind="placeholder" files={["src/data/company.ts"]} />
    </>
  );
}
