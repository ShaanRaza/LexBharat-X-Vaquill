import type { Metadata } from "next";
import { PageHero, Section, SimpleTable, CtaBand, DataNote, CodeBlock } from "@/components/ui";
import McpSetup from "@/components/McpSetup";
import { mcpTools } from "@/data/mcpTools";
import { BRAND_SUFFIX } from "@/lib/release";
import { dev } from "@/lib/release";

export const metadata: Metadata = { title: `US Statutes MCP Server | ${BRAND_SUFFIX}` };

export default function Mcp() {
  return (
    <>
      <PageHero
        eyebrow="MCP server"
        title="US Statutes MCP Server"
        lead="Let an AI assistant search the US Code, the CFR and state codes directly. Every section ships as JSON for your code, and HTML, text, PDF or DOCX for the humans reading it."
        actions={[{ label: "Get API key", href: "/auth/signup" }, { label: "Book a demo", href: "/contact", variant: "secondary" }]}
      >
        <div className="mt-8 max-w-[520px]"><CodeBlock label="install (placeholder package name)" code="pip install lexbharat-mcp" /></div>
      </PageHero>
      <Section tone="accent" title="Statute tools via MCP" lead={"Every tool maps to an API endpoint." + dev(" This is the catalog only; there is no running MCP server in this build.")}>
        <SimpleTable head={["Tool", "What it does"]} rows={mcpTools.map(([n, d]) => [<code key="n" className="font-mono text-[12.5px]">{n}</code>, d])} />
      </Section>
      <Section title="MCP server setup in two minutes" lead="Pick your client. Snippets are illustrative; the package names are placeholders.">
        <McpSetup />
      </Section>
      <CtaBand title="Ground your agent in primary law." primary={{ label: "Get API key", href: "/auth/signup" }} secondary={{ label: "Claude Code plugin", href: "/claude-plugin" }} />
      <DataNote kind="static" files={["src/data/mcpTools.ts"]} />
    </>
  );
}
