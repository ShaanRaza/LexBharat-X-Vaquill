import type { Metadata } from "next";
import { PageHero, Section, CardGrid, Card, SimpleTable, CtaBand, DataNote } from "@/components/ui";
import { pluginCommands } from "@/data/mcpTools";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Claude Code Plugin | ${BRAND_SUFFIX}` };

export default function Plugin() {
  return (
    <>
      <PageHero
        eyebrow="Plugin"
        title="Primary Law for Claude"
        lead="A plugin that gives Claude access to US primary law and teaches it how to read the results honestly: statutes, regulations, court rules, constitutions and agency guidance."
        actions={[{ label: "Get an API key", href: "/auth/signup" }, { label: "View source (placeholder)", href: "#", variant: "secondary", disabled: true }]}
      />
      <Section title="What the plugin adds" lead="Three layers: the MCP server carries the data, the skill carries the judgment, and the commands are the workflows people actually run.">
        <CardGrid>
          <Card title="One MCP server">The full API as tools: search, citation resolution, section text, point-in-time reconstruction.</Card>
          <Card title="A research skill">The part a tool schema cannot carry: which corpus to scope to, what a currency verdict means, how to report without overclaiming.</Card>
          <Card title="Ten commands">One per workflow that genuinely differs in shape, not one per corpus.</Card>
        </CardGrid>
      </Section>
      <Section tone="accent" title="The commands">
        <SimpleTable head={["Command", "What it does"]} rows={pluginCommands.map(([c, d]) => [<code key="c" className="font-mono text-fs-12.5">/primary-law:{c}</code>, d])} />
      </Section>
      <Section title="Why the skill matters more than the tools" lead="An API can hand a model the right text and still get a wrong answer out of it. These are the failure modes the skill is designed to prevent.">
        <CardGrid cols={2}>
          <Card title="Identifiers come from the API, never from a citation">Hand-built section ids tend to 404, and the failure reads like missing coverage.</Card>
          <Card title="The body is not always the operative law">Notes and history can be a large share of a section body, so the skill fetches the split operative text.</Card>
          <Card title="Unverified is not the same as current">A result's currency verdict must be reported, not assumed.</Card>
          <Card title="An empty result is not an absence of law">Check coverage for the jurisdiction first.</Card>
        </CardGrid>
      </Section>
      <CtaBand title="Give your assistant real law to read." primary={{ label: "Get an API key", href: "/auth/signup" }} />
      <DataNote kind="static" files={["src/data/mcpTools.ts"]} />
    </>
  );
}
