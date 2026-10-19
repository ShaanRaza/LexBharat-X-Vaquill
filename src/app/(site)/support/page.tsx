import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Section, CardGrid, Card, DataNote } from "@/components/ui";
import { supportTopics } from "@/data/company";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Support | ${BRAND_SUFFIX}` };

export default function Support() {
  return (
    <>
      <PageHero eyebrow="Support" title="How can we help?" lead="Help with the data API, the MCP server and add-ins: contact us, work through common issues, or dive into the documentation." />
      <Section>
        <CardGrid>{supportTopics.map(([t, d]) => <Card as="h2" key={t} title={t}>{d}</Card>)}</CardGrid>
        <p className="mt-8 text-[15px]">Prefer a form? <Link href="/contact" className="text-primary hover:underline">Go to contact</Link>. Or start with the <Link href="/docs/api-guide/quickstart" className="text-primary hover:underline">quickstart</Link>. Using the Word add-in? See the <Link href="/word/sideload" className="text-primary hover:underline">install guide</Link>. Security issue? <Link href="/security/vulnerability-disclosure" className="text-primary hover:underline">Report it here</Link>.</p>
      </Section>
      <DataNote kind="placeholder" files={["src/data/company.ts"]} />
    </>
  );
}
