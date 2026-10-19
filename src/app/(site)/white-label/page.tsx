import type { Metadata } from "next";
import { PageHero, Section, SimpleTable, CardGrid, Card, CtaBand, DataNote } from "@/components/ui";
import { BRAND_SUFFIX } from "@/lib/release";
import { dev } from "@/lib/release";

export const metadata: Metadata = { title: `White label | ${BRAND_SUFFIX}` };

const models: string[][] = [
  ["Branded workspace", "Your name, logo, colors and login, on your domain", "Our cloud, we operate it", "Nothing"],
  ["Dedicated instance", "Same, plus your security posture", "Single tenant, your cloud or ours", "Nothing"],
  ["Workspace API", "Only your product. No trace of us", "Your backend calls ours", "Your whole interface"],
  ["Embeddable widget", "Your title, accent color and host", "Self-hosted, Docker or Node", "A script tag"],
  ["Primary law API", "Your product, attribution waivable", "Our cloud, REST and MCP", "Everything above the data"],
  ["Bulk delivery", "Your product entirely", "Synced into your database", "Everything"],
];

export default function WhiteLabel() {
  return (
    <>
      <PageHero
        eyebrow="White label"
        title="Run LexBharat under your own brand"
        lead="A legal AI workspace your customers know as yours. Take the whole product on your own domain, or just the engine underneath your existing interface."
        actions={[{ label: "Talk to us", href: "/contact" }, { label: "Microsoft Word add-in", href: "/word", variant: "secondary" }]}
      />
      <Section tone="accent" title="Six ways to deploy it" lead="Separable, and stackable. What decides it is how much of the interface you want to own, and where the data has to sit.">
        <SimpleTable head={["Model", "What your users see", "Where it runs", "What you build"]} rows={models} />
      </Section>
      <Section title="What you are putting your name on" lead={"Surfaces your customers spend the most time in" + dev(" (descriptions paraphrased from the public page; the product itself is not part of this build)") + "."}>
        <CardGrid>
          <Card title="Contract review against your playbook">Clauses tagged Escalate, Negotiate or Acceptable, with the current language, the risk and your position side by side.</Card>
          <Card title="Redlines inside Word">An add-in where each proposed change carries its reason, a fallback and one-click accept.</Card>
          <Card title="Compare any two versions">Substantive changes held apart from cosmetic ones; side-by-side, redline or three-pane.</Card>
          <Card title="Tabular review across a document set">Ask the same questions of many documents at once; every answer cited and human-approved.</Card>
        </CardGrid>
      </Section>
      <CtaBand title="Ship it as yours." primary={{ label: "Contact sales", href: "/contact" }} />
      <DataNote kind="placeholder" files={["src/app/(site)/white-label/page.tsx"]} />
    </>
  );
}
