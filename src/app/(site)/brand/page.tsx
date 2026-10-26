import type { Metadata } from "next";
import { PageHero, Section, DataNote } from "@/components/ui";
import { Wordmark } from "@/components/Nav";
import MockBadge from "@/components/MockBadge";
import { brandColors } from "@/data/company";
import DevOnly from "@/components/DevOnly";
import { BRAND_SUFFIX } from "@/lib/release";
import { dev } from "@/lib/release";

export const metadata: Metadata = { title: `Brand assets | ${BRAND_SUFFIX}` };

const files: [string, string, string][] = [
  ["Mark, colour", "lexbharat-mark-color.svg", "bg-surface"],
  ["Mark, on white tile", "lexbharat-mark-on-white.svg", "bg-surface"],
  ["Mark, on dark tile", "lexbharat-mark-on-dark.svg", "bg-dark"],
  ["Mark, white", "lexbharat-mark-white.svg", "bg-dark"],
  ["Mark, black", "lexbharat-mark-black.svg", "bg-surface"],
  ["Lockup, colour", "lexbharat-lockup-color.svg", "bg-surface"],
  ["Lockup, white", "lexbharat-lockup-white.svg", "bg-dark"],
];

export default function Brand() {
  return (
    <>
      <PageHero eyebrow="Brand" title="Brand assets" lead={"Logos, colors and usage guidelines." + dev(" These logo files are original placeholder artwork made for this local build; the colors are the design tokens this app actually uses.")} />
      <Section title="Logo files" lead="Original SVG files served from /brand/. Download any of them.">
        <DevOnly><p className="mb-4 text-fs-sm text-muted"><MockBadge>original placeholder artwork</MockBadge> Not the real company's logo.</p></DevOnly>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {files.map(([label, file, bg]) => (
            <figure key={file} className="overflow-hidden rounded-panel border border-border bg-surface">
              <div className={`grid h-36 place-items-center ${bg}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/brand/${file}`} alt={label} className="max-h-24 max-w-[80%]" />
              </div>
              <figcaption className="flex items-center justify-between p-3 text-fs-ui"><span>{label}</span><a href={`/brand/${file}`} download className="inline-block py-1.5 pl-2 text-primary hover:underline">svg ↓</a></figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="grid h-32 place-items-center rounded-panel border border-border bg-surface"><Wordmark /></div>
          <div className="grid h-32 place-items-center rounded-panel bg-dark"><Wordmark light /></div>
        </div>
      </Section>
      <Section tone="accent" title="Colors">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {brandColors.map(([n, c]) => (
            <div key={n} className="overflow-hidden rounded-panel border border-border bg-surface">
              <div className="h-20" style={{ background: c }} />
              <div className="p-3 text-fs-ui"><p className="font-medium">{n}</p><p className="font-mono text-fs-xs text-muted">{c}</p></div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Usage guidelines" lead="Placeholder guidelines.">
        <ul className="list-disc space-y-1 pl-6 text-fs-lead"><li>Keep clear space around the mark equal to the width of the leaf's stem.</li><li>Use the white mark on dark backgrounds only.</li><li>Do not recolor, rotate or stretch the mark.</li></ul>
      </Section>
      <DataNote kind="static" files={["public/brand/*.svg", "src/data/company.ts", "src/app/globals.css (tokens)"]} />
    </>
  );
}
