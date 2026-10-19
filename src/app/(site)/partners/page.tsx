import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Section, CardGrid, Card, DataNote } from "@/components/ui";
import { sources } from "@/data/company";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Data sources & credits | ${BRAND_SUFFIX}` };

export default function Partners() {
  return (
    <>
      <PageHero eyebrow="Credits" title="Data sources & credits" lead="The statute corpus is built on public-domain government sources. These are the open projects and agencies that make primary law free to read." />
      <Section title="Open government sources">
        <CardGrid>{sources.map((s) => <Card key={s.name} title={s.name}>{s.note}</Card>)}</CardGrid>
        <p className="mt-8"><Link href="/" className="text-primary hover:underline">← Back to home</Link></p>
      </Section>
      <DataNote kind="static" files={["src/data/company.ts"]} />
    </>
  );
}
