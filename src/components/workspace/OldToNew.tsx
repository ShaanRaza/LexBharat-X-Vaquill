"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Button, Notice, Panel } from "@/components/kit";
import SearchField from "@/components/workspace/SearchField";
import common from "@/config/old-to-new-common.json";
import mapping from "@/config/law-mapping.json";
import { PAIRS, checkedCount, commonGroups, displayTitle, lookup, presentation, rowLinks, rowsFor, type LawKey, type MappingData, type MappingRow } from "@/lib/acts/lawMapping.mjs";

// "Old law to new law": a search box, the most common sections first, and the whole table per pair only on request. Presentation only: the data is src/config/law-mapping.json and every decision
// (what is shown as fact, what links, what is counted as checked) is made by src/lib/acts/lawMapping.mjs. Colours, fonts, sizes and radii come from the shared tokens through the kit components.
const data = mapping as unknown as MappingData;
const TITLES: Record<string, string> = { ipc: "IPC to BNS", crpc: "CrPC to BNSS", evidence: "Evidence Act to BSA" };
const fmt = (n: number) => n.toLocaleString("en-IN");

function Sec({ law, section, href }: { law: LawKey; section: string; href: string | null }) {
  const text = `${data.laws[law].label} ${section}`;
  return href ? <Link href={href} className="font-medium text-primary hover:underline">{text}</Link> : <span className="font-medium">{text}</span>;
}

/** A section's title as the page prints it; the data holds raw headings, so it always goes through displayTitle. */
function Title({ raw }: { raw: string }) {
  const t = displayTitle(raw);
  return <p className={`text-ui-sm ${t ? "" : "text-muted"}`}>{t ?? "Title not available"}</p>;
}

function Row({ row }: { row: MappingRow }) {
  const p = presentation(row), links = rowLinks(row, data);
  return (
    <Panel as="li" className={p.fact ? "" : "bg-sunken/60 text-muted"}>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-start sm:gap-4">
        <div className="min-w-0 break-words"><Sec law={row.old_law} section={row.old_section} href={links.old} /><Title raw={row.old_title} /></div>
        <span aria-hidden className="text-ui-base sm:pt-0.5">→</span>
        <div className="min-w-0 break-words"><Sec law={row.new_law} section={row.new_section} href={links.new} /><Title raw={row.new_title} /></div>
      </div>
      {(p.label || p.whatChanged) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {p.label && <Badge tone="warn" title={row.source}>{p.label}</Badge>}
          {p.whatChanged && <p className="text-ui-sm text-secondary"><span className="font-medium">What changed:</span> {p.whatChanged}</p>}
        </div>
      )}
    </Panel>
  );
}

export default function OldToNew() {
  const [q, setQ] = useState(""), [open, setOpen] = useState<string | null>(null);
  const searching = q.trim().length >= 2;
  const result = useMemo(() => (searching ? lookup(data, q) : null), [q, searching]);
  const groups = useMemo(() => commonGroups(data, common), []);
  return (
    <div className="mx-auto max-w-w1152 pt-2">
      <h1 className="font-serif text-ui-title font-semibold">Old law to new law</h1>
      <p className="mt-1 text-ui-lead text-secondary">How the Indian Penal Code, 1860, the Code of Criminal Procedure, 1973 and the Indian Evidence Act, 1872 map to the Bharatiya Nyaya Sanhita, Bharatiya Nagarik Suraksha Sanhita and Bharatiya Sakshya Adhiniyam (all 2023, in force from 1 July 2024).</p>

      <Notice tone="warn" className="mt-4" compact>Offences before 1 July 2024 are still tried under the old law. This page is for research and is not legal advice.</Notice>

      <div className="mt-5">
        <SearchField id="o2n-q" value={q} onChange={setQ} label="Look up a section in the old or new law" placeholder={'Try "302 IPC" or "103 BNS"'} shortPlaceholder="302 IPC or 103 BNS" />
        <div aria-live="polite" className="mt-3">
          {searching && !result && <p className="text-ui-base text-muted">Not understood. Type a section number and a law, like &ldquo;302 IPC&rdquo;, &ldquo;438 CrPC&rdquo;, &ldquo;103 BNS&rdquo; or &ldquo;65B Evidence Act&rdquo;.</p>}
          {result && !result.rows.length && <p className="text-ui-base text-muted">No row for {result.law ? `${data.laws[result.law].label} ` : ""}{result.number} in this table. The table is not complete, so that does not mean the section has no counterpart.</p>}
          {result && result.rows.length > 0 && <ul className="space-y-2">{result.rows.map((r) => <Row key={`${r.old_law}-${r.old_section}`} row={r} />)}</ul>}
        </div>
      </div>

      {!searching && (
        <>
          <section aria-labelledby="o2n-common" className="mt-8">
            <h2 id="o2n-common" className="text-ui-lead font-semibold">Most common sections</h2>
            <div className="mt-3 space-y-5">
              {groups.map((g) => (
                <div key={g.label}>
                  <h3 className="text-ui-base font-semibold text-secondary">{g.label}</h3>
                  <ul className="mt-2 space-y-2">{g.rows.map((r) => <Row key={`${r.old_law}-${r.old_section}`} row={r} />)}</ul>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="o2n-all" className="mt-10">
            <h2 id="o2n-all" className="text-ui-lead font-semibold">The whole table</h2>
            {PAIRS.map(([o, n]) => {
              const rows = rowsFor(data, o), nOk = checkedCount(rows), shown = open === o;
              return (
                <div key={o} className="mt-5">
                  <h3 className="text-ui-base font-semibold">{TITLES[o]}</h3>
                  <p className="mt-1 text-ui-base text-secondary">
                    <Link href={`/law/${data.laws[o].actId}`} className="text-primary hover:underline">{data.laws[o].name}</Link> was repealed and replaced by{" "}
                    <Link href={`/law/${data.laws[n].actId}`} className="text-primary hover:underline">{data.laws[n].name}</Link>. {fmt(nOk)} of {fmt(rows.length)} section rows checked against our data.
                  </p>
                  <Button variant="secondary" size="sm" className="mt-2" aria-expanded={shown} onClick={() => setOpen(shown ? null : o)}>{shown ? "Hide the table" : `Show all ${fmt(rows.length)} rows`}</Button>
                  {shown && <ul className="mt-3 space-y-2">{rows.map((r) => <Row key={r.old_section} row={r} />)}</ul>}
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
