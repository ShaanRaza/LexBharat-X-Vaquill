import type { Metadata } from "next";
import { PageHero, Section, CardGrid, Card, DataNote } from "@/components/ui";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `For lawyers | ${BRAND_SUFFIX}` };

const items: [string, string][] = [
  ["AI & lawyer ethics", "Professional-conduct guidance and state-bar views on using AI, with sample client disclosures."],
  ["Sample firm AI policy", "A starter policy for small firms (available on request in the real product)."],
  ["Client disclosure letter", "Sample engagement-letter language disclosing AI use."],
  ["Security & trust", "How privileged client data is protected: data locations, no training on your data, encryption."],
  ["Integrations for your stack", "What the product connects to today."],
  ["Comparison with incumbents", "An honest cost and feature comparison for solo and small-firm budgets."],
  ["How citation verification works", "A plain-language explainer of a layered citation check."],
  ["Practice-area overviews", "Litigation, corporate and solo-practitioner starting points."],
];

export default function ForLawyers() {
  return (
    <>
      <PageHero eyebrow="For lawyers" title="Responsible AI, ethics, and US law data resources." lead="Reference material on using AI responsibly with US primary law." actions={[{ label: "Read the AI ethics guide", href: "/for-lawyers/ethics" }, { label: "Explore the API", href: "/legal-api", variant: "secondary" }]} />
      <Section title="Everything you need, in one place" lead="Ethics guidance, security documentation, integrations, comparisons and practice-area resources (placeholder summaries).">
        <CardGrid>{items.map(([t, d]) => <Card key={t} title={t}>{d}</Card>)}</CardGrid>
      </Section>
      <DataNote kind="placeholder" files={["src/app/(site)/for-lawyers/page.tsx"]} />
    </>
  );
}
