import type { Metadata } from "next";
import { PageHero, Section, Bullets, SimpleTable, CtaBand, DataNote, CardGrid, Card } from "@/components/ui";
import { endpoints, endpointGroups } from "@/data/endpoints";
import { BRAND_SUFFIX } from "@/lib/release";
import { dev } from "@/lib/release";

export const metadata: Metadata = { title: `US Statutes API | ${BRAND_SUFFIX}` };

export default function LegalApi() {
  return (
    <>
      <PageHero
        eyebrow="Statutes API"
        title="US Statutes API: US Code, CFR and state codes"
        lead="The US Code, the CFR and every state and territory code through one self-serve API: REST, MCP or SQL. Every section is cited and linked to its official source."
        actions={[{ label: "Get API key", href: "/auth/signup" }, { label: "Read the docs", href: "/docs", variant: "secondary" }]}
      />
      <Section tone="accent" title="Build the pipeline yourself, or make one call.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-card border border-border bg-surface p-6">
            <p className="font-mono text-fs-nano uppercase tracking-wider text-error">The hard way</p>
            <h3 className="mt-1 text-fs-20 font-semibold">Build the pipeline yourself</h3>
            <div className="mt-4"><Bullets tone="cross" items={["Dozens of government sites, each in its own format", "PDFs and XML with broken tables and footnotes", "Section hierarchy, amendments and metadata", "A search index you build and keep in sync", "Re-scrape it all, forever, as the law changes"]} /></div>
            <p className="mt-4 text-fs-ui text-muted">Weeks of setup. Maintenance that never ends.</p>
          </div>
          <div className="rounded-panel border border-primary/40 bg-surface p-6">
            <p className="font-mono text-fs-nano uppercase tracking-wider text-success">The API</p>
            <h3 className="mt-1 text-fs-20 font-semibold">Or make one call</h3>
            <div className="mt-4"><Bullets items={["Indexed and normalized to one schema", "Cited, with a link to the official source", "Relevance-ranked; filter by state or corpus", "Refreshed on a per-source schedule"]} /></div>
            <p className="mt-4 text-fs-ui text-muted">One API key.{dev(" (Mock: no real service behind this build.)")}</p>
          </div>
        </div>
      </Section>
      <Section id="coverage" title="Endpoints you will use most" lead="A selection of the endpoints listed on the public page. Try any of them in the playground (mock responses).">
        {endpointGroups.map((g) => (
          <div key={g} className="mb-6">
            <h3 className="mb-2 text-fs-lead font-semibold">{g}</h3>
            <SimpleTable head={["Method", "Path", "What it does", "Credits"]}
              rows={endpoints.filter((e) => e.group === g).map((e) => [<span key="m" className="font-mono text-fs-xs">{e.method}</span>, <code key="p" className="font-mono text-fs-12.5">{e.path}</code>, e.summary, String(e.credits)])} />
          </div>
        ))}
      </Section>
      <Section title="Who builds on it" lead="Teams use the API instead of scraping and normalizing government sources themselves.">
        <CardGrid cols={2}>
          <Card title="Legal tech developers" href="/use-case/legal-tech-developers" tag="Use case">Stop building statute data infrastructure from scratch.</Card>
          <Card title="Lawyers and firms" href="/for-lawyers" tag="Use case">Ethics, security and verification resources for AI use.</Card>
        </CardGrid>
      </Section>
      <CtaBand title="One key. Cited law in every response." primary={{ label: "Try the playground", href: "/playground" }} secondary={{ label: "Read the docs", href: "/docs" }} />
      <DataNote kind="static" files={["src/data/endpoints.ts"]} />
    </>
  );
}
