import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Section, CardGrid, Card, Bullets, CtaBand, DataNote } from "@/components/ui";
import MockBadge from "@/components/MockBadge";
import { wordFeatures, wordSteps } from "@/data/extraPages";
import DevOnly from "@/components/DevOnly";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `LexBharat for Word | ${BRAND_SUFFIX}` };

export default function Word() {
  return (
    <>
      <PageHero
        eyebrow="Microsoft Word add-in"
        title="LexBharat for Word"
        lead="Statute and regulation lookup grounded in the US primary law corpus, inside Microsoft Word. No copy-paste into a separate tab: ask in the task pane and get an answer with checkable citations."
        actions={[{ label: "Get started: create your account", href: "/auth/signup" }, { label: "Install guide", href: "/word/sideload", variant: "secondary" }]}
      >
        <DevOnly><p className="mt-6 text-[13px] text-muted"><MockBadge>no add-in exists</MockBadge> This page recreates the marketing page only. There is no Word add-in in this build.</p></DevOnly>
      </PageHero>

      <Section tone="accent" title="What it does in Word" lead="Everything happens on the file you have open, and applies as native Word changes. Every answer carries checkable sources.">
        <CardGrid>{wordFeatures.map(([t, d]) => <Card key={t} title={t}>{d}</Card>)}</CardGrid>
      </Section>

      <Section title="Hosted, or bring your own key" lead="The add-in is described as open source: run the hosted edition for the full product, or a community build on your own AI key.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-panel border border-primary/40 bg-surface p-6">
            <h3 className="text-[20px] font-semibold">Account (hosted)</h3>
            <p className="mt-1 text-[15px] text-muted">Sign in and answers are grounded in the full statute corpus, with cited authority. Nothing to run.</p>
            <div className="mt-4"><Bullets items={["Grounded in case law and statutes, with cited authority", "Statute verification and good-law signals", "Document compare and tracked-changes export", "Save work back to your matters and web app"]} /></div>
          </div>
          <div className="rounded-panel border border-border bg-surface p-6">
            <h3 className="text-[20px] font-semibold">Bring your own key (community)</h3>
            <p className="mt-1 text-[15px] text-muted">An open-source build that runs on your own AI provider key, with no account and no hosted backend.</p>
            <div className="mt-4"><Bullets items={["Open source and self-hostable; no account required", "Your own provider key, kept on your device", "Full document tools, review, redlines and drafting", "Playbooks and prompt libraries saved locally"]} /></div>
            <p className="mt-4 text-[14px]"><Link href="/word/sideload" className="text-primary hover:underline">Install guide →</Link></p>
          </div>
        </div>
      </Section>

      <Section tone="accent" title="How to install" lead="The add-in is described as not yet in Microsoft's store, so for now it is added by hand. It takes about three minutes.">
        <ol className="grid gap-4 md:grid-cols-2">
          {wordSteps.map((s, i) => (
            <li key={s} className="flex gap-4 rounded-panel border border-border bg-surface p-5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-[14px] text-primary">{i + 1}</span>
              <span className="text-[15px] leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6"><Link href="/word/sideload" className="btn btn-secondary">Step-by-step install guide</Link></p>
      </Section>

      <CtaBand title="Create your account." primary={{ label: "Create account", href: "/auth/signup" }} secondary={{ label: "See how it works", href: "/blog" }} />
      <DataNote kind="placeholder" files={["src/data/extraPages.ts"]} />
    </>
  );
}
