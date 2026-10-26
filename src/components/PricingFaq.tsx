"use client";
import Link from "next/link";
import { useState } from "react";
import Reveal from "./Reveal";
import MockBadge from "./MockBadge";
import DevOnly from "@/components/DevOnly";

const features = [
  ["API Playground", "Run the API before you write a line of code."],
  ["Law Change Alerts", "Know when the law you rely on changes."],
];

const tiers = [
  { name: "Pro", tag: "Where most builds start.", items: ["20,000 API credits included every month", "Up to 2 API keys", "Attribution required", "Law change alerts by email", "Email support"], cta: "Start with Pro now", who: ["Businesses testing a data backend", "Lawyers verifying answers", "Developers evaluating coverage"] },
  { name: "Business", tag: "For shipping data inside your product.", items: ["200,000 API credits included every month", "Up to 10 API keys", "Invite your team", "Law change alerts by webhook", "Point-in-time state law", "Attribution waived", "Priority support"], cta: "Start with Business", who: ["Legal tech products", "Compliance platforms", "AI teams grounding agents"] },
];

const faq = [
  ["What does the API cover?", "Placeholder answer: primary law other than case law, across federal and state jurisdictions. See the coverage section above."],
  ["How do I get an API key?", "Placeholder answer: sign up, then create a key from a dashboard. (No real signup exists in this recreation.)"],
  ["How does usage and billing work?", "Placeholder answer: usage-based credits rather than seats."],
  ["Can I use the API for commercial products?", "Placeholder answer: paid tiers are for commercial use; free credits are for non-commercial work."],
  ["Why use this API instead of building my own pipeline?", "Placeholder answer: the pitch is saving the ingestion and cleanup work."],
  ["What does a response look like?", "Placeholder answer: see the Visual / JSON toggle in the demo above."],
  ["Is there an MCP server?", "Placeholder answer: yes, per the access paths section (not implemented here)."],
  ["Is there a free, open dataset?", "Placeholder answer: the public site describes an open dataset under a non-commercial license."],
  ["How fresh is the data?", "Placeholder answer: refresh cadence varies by source: daily, weekly or monthly."],
  ["Which formats can I get a section in?", "Placeholder answer: HTML, text, and source PDF or XML where available."],
  ["How is the data sourced, and is it authoritative?", "Placeholder answer: pulled from official publishers, with a source link on each section."],
  ["Can I self-host instead of calling the API?", "Placeholder answer: the public site points to open-source ingestion code and open data files."],
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-border border-y border-border">
      {faq.map(([q, a], i) => (
        <div key={q}>
          <h3>
            <button aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-4 text-left text-fs-17 font-semibold">
              {q}<span aria-hidden className={`text-fs-22 transition-transform duration-300 ${open === i ? "rotate-45" : ""}`}>+</span>
            </button>
          </h3>
          <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open === i ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <p className="overflow-hidden text-fs-body leading-relaxed text-muted"><span className="block pb-4">{a}</span></p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PricingFaq() {
  return (
    <>
      <section className="bg-accent px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-w1152">
          <h2 className="text-fs-34 font-semibold tracking-snug sm:text-fs-44">Two things you get without building them.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {features.map(([h, p], i) => (
              <Reveal key={h} delay={i * 80}>
                <article className="rounded-panel border border-border bg-surface p-6">
                  <h3 className="text-fs-20 font-semibold">{h}</h3>
                  <div className="mt-4 grid aspect-[16/9] place-items-center rounded-control bg-raised text-center text-fs-ui text-muted">{p}<br />(placeholder illustration)</div>
                  <Link href={h === "API Playground" ? "/playground" : "/alerts"} className="mt-3 inline-block py-1.5 text-fs-body text-primary hover:underline">Learn more →</Link>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-w1152">
          <h2 className="text-fs-34 font-semibold tracking-snug sm:text-fs-44">Usage-based credits, not seats.</h2>
          <DevOnly><p className="mt-2 text-fs-ui text-muted"><MockBadge>placeholder plans</MockBadge> Plan structure mirrors the public page; nothing here can be purchased.</p></DevOnly>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {tiers.map((t, i) => (
              <Reveal key={t.name} delay={i * 80}>
                <article className="flex h-full flex-col rounded-panel border border-border bg-surface p-7">
                  <h3 className="text-fs-display font-semibold">{t.name}</h3>
                  <p className="text-fs-body text-muted">{t.tag}</p>
                  <ul className="mt-5 space-y-2 text-fs-body">{t.items.map((x) => <li key={x} className="flex gap-2"><span className="text-primary">✓</span>{x}</li>)}</ul>
                  <p className="mt-6 text-fs-sm font-medium uppercase tracking-wider text-muted">Who this is for</p>
                  <ul className="mt-1 text-fs-ui text-muted">{t.who.map((x) => <li key={x}>· {x}</li>)}</ul>
                  <div className="mt-auto pt-7"><Link href="/auth/signup" className="btn btn-primary">{t.cta}</Link></div>
                </article>
              </Reveal>
            ))}
          </div>
          <article className="mt-4 rounded-panel border border-border bg-surface p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-fs-20 font-semibold">Data licensing and bulk access</h3><span className="text-fs-body text-muted">Custom</span></div>
            <ul className="mt-3 grid gap-1 text-fs-body text-muted sm:grid-cols-2">
              {["Full corpus daily sync into your own database", "The source PDFs and text files", "Train and fine-tune on all of it", "Redistribution and white-label terms", "Volume pricing, custom SLA, invoicing"].map((x) => <li key={x}>✓ {x}</li>)}
            </ul>
          </article>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
        <div className="mx-auto max-w-w860">
          <h2 className="text-fs-34 font-semibold tracking-snug">Common questions</h2>
          <div className="mt-6"><Faq /></div>
        </div>
      </section>
    </>
  );
}
