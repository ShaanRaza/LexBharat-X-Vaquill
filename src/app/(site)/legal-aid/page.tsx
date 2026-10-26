import type { Metadata } from "next";
import { PageHero, Section, CardGrid, Card, Stat, DataNote } from "@/components/ui";
import MockForm from "@/components/MockForm";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Free API for legal aid | ${BRAND_SUFFIX}` };

export default function LegalAid() {
  return (
    <>
      <PageHero
        eyebrow="Legal aid & nonprofits"
        title="Free API access for legal aid."
        lead="The full API, free for verified nonprofit legal aid and public-interest organizations."
        actions={[{ label: "Apply below", href: "#apply" }]}
      />
      <Section title="Why this exists">
        <div className="grid gap-8 sm:grid-cols-3">
          <Stat value="1.4M" label="civil legal problems reach legal aid each year (cited statistic on the public page)" />
          <Stat value="71%" label="of those got no help or not enough" />
          <Stat value="29%" label="received the help they needed" />
        </div>
        <p className="mt-6 max-w-w720 text-fs-lead leading-relaxed text-muted">Data was never legal aid's biggest constraint, staffing is, but it is one line item that should not exist. (Paraphrased; figures as displayed on the public page.)</p>
      </Section>
      <Section tone="accent" title="The same service, free">
        <CardGrid>
          <Card title="The full corpus">Nothing held back for the free tier.</Card>
          <Card title="5,000 free credits every month">Usage beyond that is discounted, not cut off.</Card>
          <Card title="REST API and MCP server">The same two ways to call it as every developer.</Card>
          <Card title="No procurement cycle">No sales call, no contract, no minimum.</Card>
          <Card title="Section-level citations">Every result linked to its official source.</Card>
          <Card title="Same docs, same support">One support channel for everyone.</Card>
        </CardGrid>
      </Section>
      <Section title="How to get access">
        <CardGrid>
          <Card title="1. Tell us about your organization">Name, mission, contact email.</Card>
          <Card title="2. Confirm nonprofit / legal aid status">A determination letter or equivalent registration.</Card>
          <Card title="3. We turn the key on">Same API, same corpus, same docs.</Card>
        </CardGrid>
      </Section>
      <Section id="apply" tone="accent" title="Apply for free legal aid access.">
        <div className="max-w-w640">
          <MockForm kind="legal-aid" submitLabel="Apply" fields={[
            { name: "name", label: "Full name", required: true },
            { name: "email", label: "Email", type: "email", required: true },
            { name: "organization", label: "Organization", required: true },
            { name: "website", label: "Website" },
            { name: "mission", label: "What are you building?", type: "textarea" },
          ]} />
        </div>
      </Section>
      <DataNote kind="mixed" files={["page copy (hardcoded)", "/api/mock/forms/legal-aid"]} />
    </>
  );
}
