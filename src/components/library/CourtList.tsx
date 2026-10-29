"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Panel } from "@/components/kit";
import { ALL_COURTS, SUPREME_COURT, type Court } from "@/data/workspaceBrowse";

// Library > Judgments: the Supreme Court and the High Courts; each opens that court's cases by year. Counts come from /api/judgments/courts when the real data is on. Presentation only.
type Courts = { source: "real" | "mock"; courts: { slug: string; cases: number | null; listable?: boolean }[] };
const fmt = (n: number) => n.toLocaleString("en-IN");

export default function CourtList() {
  const [jc, setJc] = useState<Courts | null>(null), [q, setQ] = useState("");
  useEffect(() => { fetch("/api/judgments/courts").then((r) => (r.ok ? r.json() : null)).then((j) => setJc(j as Courts | null)).catch(() => setJc(null)); }, []);
  const real = jc?.source === "real", needle = q.trim().toLowerCase();
  const info = (c: Court) => { const x = jc?.courts.find((y) => y.slug === c.slug); return { n: real ? x?.cases ?? null : null, countsOnly: real && x?.listable === false }; };
  const shown = ALL_COURTS.filter((c) => !needle || c.name.toLowerCase().includes(needle));
  return (
    <div className="mt-5">
      <input type="search" aria-label="Find a court" placeholder="Find a court" value={q} onChange={(e) => setQ(e.target.value.slice(0, 80))} className="h-10 w-full max-w-sm rounded-input bg-surface px-3 text-ui-body text-foreground ring-1 ring-control-border placeholder:text-muted focus-visible:outline-2 focus-visible:outline-primary" />
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {shown.map((c) => { const i = info(c); return (
          <Panel as="li" key={c.slug} className="px-card py-3">
            <Link href={`/library/judgments/${c.slug}`} className="text-ui-body font-medium text-primary hover:underline">{c.name}</Link>
            <p className="text-ui-sm text-muted">{i.n != null ? `${fmt(i.n)} case records${i.countsOnly ? " (counts by year only)" : ""}` : real ? "Count not captured" : c.count ? `${c.count} judgments (approximate)` : "Count not captured"}</p>
          </Panel>); })}
        {!shown.length && <li className="text-ui-base text-muted" role="status">No court matches &ldquo;{q}&rdquo;.</li>}
      </ul>
      <p className="mt-4 text-ui-sm text-muted">{SUPREME_COURT.name} judgments have full text and search; most High Court records are case metadata only (no judgment text), which the case page says plainly. Counts are distinct case records in the open-india-law dataset.</p>
    </div>
  );
}
