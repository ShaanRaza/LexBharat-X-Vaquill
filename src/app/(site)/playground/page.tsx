import type { Metadata } from "next";
import { PageHero, Section, CardGrid, Card, DataNote } from "@/components/ui";
import PlaygroundClient from "@/components/PlaygroundClient";
import { BRAND_SUFFIX } from "@/lib/release";
import { RELEASE } from "@/lib/release";

export const metadata: Metadata = { title: `API Playground | ${BRAND_SUFFIX}` };

export default function Playground() {
  return (
    <>
      <PageHero
        eyebrow="API Playground"
        title="Run the API before you write a line of code."
        lead="A query console: pick an endpoint, fill in parameters and see the response your integration would get, as rendered results or raw JSON."
        actions={[{ label: "Read the docs", href: "/docs", variant: "secondary" }]}
      />
      <Section title={RELEASE ? "Try it" : "Try it (mock responses)"} lead={RELEASE ? "Pick an endpoint, fill in its parameters and run the request." : "This console talks to a local stub. The data comes from a handful of made-up records in src/data/corpus.ts."}>
        <PlaygroundClient />
      </Section>
      <Section tone="accent">
        <CardGrid>
          <Card title="Every endpoint, one form">Pick any endpoint and the form updates to its parameters.</Card>
          <Card title="Visual or JSON">Rendered cards for reading, raw JSON for coding.</Card>
          <Card title="Copy the exact call">Each run shows request id, latency and credits, plus an equivalent curl.</Card>
        </CardGrid>
      </Section>
      <DataNote kind="mock-api" files={["src/data/endpoints.ts", "src/data/corpus.ts", "/api/mock/playground"]} />
    </>
  );
}
