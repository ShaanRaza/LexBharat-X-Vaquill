import type { Metadata } from "next";
import Link from "next/link";
import { docsNav } from "@/data/docs/nav";
import { DataNote } from "@/components/ui";
import { BRAND_SUFFIX } from "@/lib/release";
import { dev } from "@/lib/release";

export const metadata: Metadata = { title: `Documentation | ${BRAND_SUFFIX}` };

export default function DocsHome() {
  return (
    <div className="max-w-[820px]">
      <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-primary">Documentation</p>
      <h1 className="mt-2 text-[40px] font-semibold tracking-[-0.03em]">Build on US primary law</h1>
      <p className="mt-3 text-[17px] text-muted">Guides, concepts, recipes and an API reference.{dev(" Every page here is a recreated summary written for this build (original wording, observed structure). Nothing is executed.")}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {docsNav.map((s) => (
          <section key={s.title} className="rounded-panel border border-border bg-surface p-5">
            <h2 className="text-[16px] font-semibold">{s.title}</h2>
            <ul className="mt-2 space-y-1 text-[14px]">
              {s.pages.slice(0, 6).map((p) => (
                <li key={p.slug}><Link href={`/docs/${p.slug}`} className="text-primary hover:underline">{p.title}</Link></li>
              ))}
              {s.pages.length > 6 && <li className="text-muted">+ {s.pages.length - 6} more in the sidebar</li>}
            </ul>
          </section>
        ))}
      </div>
      <div className="mt-10"><DataNote kind="static" files={["src/data/docs/nav.ts", "src/data/docs/pages.ts"]} /></div>
    </div>
  );
}
