import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Section, Bullets, DataNote } from "@/components/ui";
import MockBadge from "@/components/MockBadge";
import { sideloadSteps } from "@/data/extraPages";
import DevOnly from "@/components/DevOnly";
import { BRAND_SUFFIX } from "@/lib/release";
import { dev } from "@/lib/release";
import { RELEASE } from "@/lib/release";

export const metadata: Metadata = { title: `Install LexBharat for Word manually | ${BRAND_SUFFIX}` };

export default function Sideload() {
  return (
    <>
      <PageHero eyebrow="Word add-in · install guide" title="Install LexBharat for Word manually" lead="The add-in is not in the Microsoft store yet, so you add it by hand: download one small file and upload it in Word. This guide is for Word on the web and Word for Mac." />
      <Section>
        <div className="max-w-w760">
          <DevOnly><p className="mb-6 text-fs-sm text-muted"><MockBadge>placeholder guide</MockBadge> Steps follow the public guide's order; wording is original. There is no real manifest file to download.</p></DevOnly>
          <h2 className="text-fs-26 font-semibold tracking-tight">Before you start</h2>
          <div className="mt-3"><Bullets tone="dot" items={["A Microsoft 365 account, so you can open a document in Word on the web or Word for Mac.", "The manifest file: the one small file Word needs." + dev(" (Not available in this build.)")]} /></div>
          <a aria-disabled="true" className="btn btn-primary mt-5 cursor-not-allowed opacity-50" onClick={undefined}>Download manifest.xml{RELEASE ? "" : " (disabled: mock)"}</a>
          <ol className="mt-10 space-y-5">
            {sideloadSteps.map(([h, d], i) => (
              <li key={h} className="flex gap-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-fs-ui text-primary">{i + 1}</span>
                <div><h3 className="text-fs-xl font-semibold">{h}</h3><p className="mt-1 text-fs-body leading-relaxed text-muted">{d}</p></div>
              </li>
            ))}
          </ol>
          <h2 className="mt-12 text-fs-26 font-semibold tracking-tight">That’s it, you’re in</h2>
          <p className="mt-2 text-fs-lead leading-relaxed text-muted">The add-in now lives in your Word ribbon. Open the task pane to look up statutes and regulations.</p>
          <h3 className="mt-8 text-fs-xl font-semibold">On Word for Windows?</h3>
          <p className="mt-1 text-fs-body text-muted">Placeholder: the real guide has a separate note for Windows.</p>
          <h3 className="mt-6 text-fs-xl font-semibold">Not seeing the button?</h3>
          <p className="mt-1 text-fs-body text-muted">Placeholder troubleshooting. See <Link href="/support" className="text-primary hover:underline">Support</Link>.</p>
        </div>
      </Section>
      <DataNote kind="placeholder" files={["src/data/extraPages.ts"]} />
    </>
  );
}
