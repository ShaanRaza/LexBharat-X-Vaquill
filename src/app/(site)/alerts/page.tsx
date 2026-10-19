import type { Metadata } from "next";
import { PageHero, Section, CardGrid, Card, CodeBlock, CtaBand, DataNote } from "@/components/ui";
import AlertsClient from "@/components/AlertsClient";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Law Change Alerts | ${BRAND_SUFFIX}` };

const payload = `POST https://example.com/hooks/lexbharat
X-LexBharat-Event: board.updated
X-LexBharat-Signature: sha256=<hmac over the raw body>

{
  "event": "board.updated",
  "source": "Washington statutes",
  "changes": [{ "section": "…", "kind": "amended", "hasDiff": true }]
}`;

export default function Alerts() {
  return (
    <>
      <PageHero
        eyebrow="Law Change Alerts"
        title="Know when the law you rely on changes."
        lead="Subscribe to a jurisdiction or corpus and get a webhook or email when it refreshes with real changes, down to the sections added, amended or removed. No polling."
        actions={[{ label: "Read the docs", href: "/docs/api-guide/alerts", variant: "secondary" }]}
      />
      <Section title="How it works">
        <CardGrid>
          <Card title="On each refresh">You are notified when a source publishes new, changed or removed law, on the schedule the source already runs on.</Card>
          <Card title="What arrives">A POST with an event header. Test deliveries use a different event so your handler can tell them apart.</Card>
          <Card title="Verifying it">Add a signing secret and every delivery carries an HMAC signature over the raw body.</Card>
        </CardGrid>
      </Section>
      <Section tone="accent" title="Subscribe once, get every change." lead="A source is something you can watch (a state's statutes, a federal register). A watch is your subscription to one.">
        <AlertsClient />
        <div className="mt-8 max-w-[640px]"><CodeBlock label="example delivery (illustrative)" code={payload} /></div>
      </Section>
      <CtaBand title="Stop polling for changes you might miss." primary={{ label: "Get API key", href: "/auth/signup" }} />
      <DataNote kind="mock-api" files={["/api/mock/watches", "src/lib/mockStore.ts (simulated in-memory database)"]} />
    </>
  );
}
