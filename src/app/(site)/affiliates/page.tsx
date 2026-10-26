import type { Metadata } from "next";
import { PageHero, Section, CardGrid, Card, Bullets, DataNote } from "@/components/ui";
import MockForm from "@/components/MockForm";
import { BRAND_SUFFIX } from "@/lib/release";
import { dev } from "@/lib/release";

export const metadata: Metadata = { title: `Affiliate program | ${BRAND_SUFFIX}` };

export default function Affiliates() {
  return (
    <>
      <PageHero
        eyebrow="Affiliate program"
        title="Earn 20% of what your referrals spend"
        lead={"Write about the API, send people to it, and take a fifth of what they spend in their first year. Subscriptions and top-ups both." + dev(" (Terms shown as on the public page; nothing is payable in this build.)")}
        actions={[{ label: "Apply to the program", href: "#apply" }, { label: "See what you would send them to", href: "/legal-api", variant: "secondary" }]}
      />
      <Section title="How it works">
        <CardGrid>
          <Card title="1. Apply">Send your name and where you publish. A reply within two business days.</Card>
          <Card title="2. Share your link">Posts, docs, newsletters, READMEs. New sign-ups through your link are yours.</Card>
          <Card title="3. Get paid monthly">Commission is held until the refund window closes, then paid out.</Card>
        </CardGrid>
      </Section>
      <Section tone="accent" title="Who this is for">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-card border border-border bg-surface p-6"><h3 className="mb-3 text-fs-xl font-semibold">A good fit</h3>
            <Bullets items={["Developers and technical writers covering legal data, RAG or agent tooling", "Legal ops consultants and legal IT firms", "Newsletter and community operators", "Maintainers of docs, awesome-lists and directories"]} /></div>
          <div className="rounded-card border border-border bg-surface p-6"><h3 className="mb-3 text-fs-xl font-semibold">Not eligible</h3>
            <Bullets tone="cross" items={["Lawyers recommending to their own clients without required disclosures", "In-house counsel referring their own employer", "Coupon, deal and cashback sites", "Anyone bidding on brand terms in paid search"]} /></div>
        </div>
      </Section>
      <Section id="apply" title="Tell us where you publish">
        <div className="max-w-w640"><MockForm kind="affiliate" submitLabel="Apply" fields={[
          { name: "name", label: "Name", required: true },
          { name: "email", label: "Email", type: "email", required: true },
          { name: "where", label: "Where you publish", required: true },
          { name: "topics", label: "What you write about", type: "textarea" },
        ]} /></div>
      </Section>
      <DataNote kind="mixed" files={["page copy (hardcoded)", "/api/mock/forms/affiliate"]} />
    </>
  );
}
