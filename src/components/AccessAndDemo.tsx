"use client";
import { useState } from "react";
import Reveal from "./Reveal";
import MockBadge from "./MockBadge";
import DevOnly from "@/components/DevOnly";

const paths = [
  ["REST", "The hosted API.", "If your product looks up law a section at a time.", "§"],
  ["MCP", "The same corpus inside an agent.", "If you want an assistant to look the law up for you, no code.", "◇"],
  ["SQL over the object store", "Query the corpus as a database.", "If you would rather hold the data yourself and query it.", "▤"],
  ["Vector index", "Skip rebuilding retrieval.", "If you are building AI search and do not want to index it yourself.", "∴"],
];

const sql = `-- Illustrative only. The real site shows a DuckDB query over public files.
SELECT citation, section_title, word_count
FROM read_parquet('https://data.lexbharat.example/placeholder.parquet')
LIMIT 5;`;

const details = [
  ["Citation in, section out", "Bluebook-style and local citation forms resolve to one exact provision."],
  ["Point-in-time", "Pass an as-of date to read a section as it stood on a past date."],
  ["Change alerts", "Watch a section or a corpus. Webhooks and email when the text changes."],
  ["Formats per section", "Styled HTML, plain text, and the publisher’s own PDF or XML where available."],
];

type Rec = Record<string, unknown> | null;

function ApiDemo() {
  const [view, setView] = useState<"Visual" | "JSON">("Visual");
  const [data, setData] = useState<Rec>(null);
  const [busy, setBusy] = useState(false);
  const cite = "42 U.S.C. § 1983";

  async function run() {
    setBusy(true);
    try {
      const r = await fetch(`/api/mock/resolve?cite=${encodeURIComponent(cite)}`);
      setData(await r.json());
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="overflow-hidden rounded-panel border border-[var(--code-border)] bg-[var(--code-bg)]">
        <div className="flex items-center justify-between border-b border-[var(--code-border)] px-4 py-2 font-mono text-[12px] text-muted">
          <span>request.sh</span>
          <button onClick={run} disabled={busy} className="rounded-control bg-primary px-3 py-1 font-sans text-[12px] font-medium text-white hover:bg-primary-hover disabled:opacity-60">{busy ? "Running…" : "Run (mock)"}</button>
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-[#2c2620]">
{`curl -G https://api.lexbharat.example/v1/statutes/resolve \\
  -H "Authorization: Bearer $API_KEY" \\
  --data-urlencode "cite=${cite}"`}
        </pre>
        <DevOnly><p className="border-t border-[var(--code-border)] px-4 py-2 text-[12px] text-muted"><MockBadge>mock</MockBadge> The button calls a local stub, <code className="font-mono">/api/mock/resolve</code>.</p></DevOnly>
      </div>

      <div className="rounded-panel border border-border bg-surface">
        <div role="tablist" className="flex gap-1 border-b border-border p-2">
          {(["Visual", "JSON"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-control px-3 py-1 text-[14px] ${view === v ? "bg-raised font-medium" : "text-muted hover:text-foreground"}`}>{v}</button>
          ))}
        </div>
        <div className="p-5 text-[15px]">
          {!data ? <p className="text-muted">Press “Run (mock)” to see the simulated response.</p> : view === "JSON" ? (
            <pre className="overflow-x-auto font-mono text-[12px] leading-5">{JSON.stringify(data, null, 2)}</pre>
          ) : (
            <>
              <p className="text-[13px] text-muted">Title 42 › Chapter 21 › Subchapter I › § 1983</p>
              <h4 className="mt-1 text-[18px] font-semibold">{String(data.title)}</h4>
              <p className="text-muted">{String(data.cite)} ({String(data.edition)})</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
                <span className="rounded-full bg-raised px-2 py-0.5">US Code</span>
                <span className="rounded-full bg-raised px-2 py-0.5">{String(data.jurisdiction)}</span>
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-success">{String(data.status)}</span>
              </div>
              <p className="mt-3 text-muted">{String(data.excerpt)}</p>
              <p className="mt-3 text-[13px] text-muted">Last amended 1996 · 2 amendments</p>
              <p className="mt-3 flex gap-4 text-[14px] text-primary"><span title="Mock link: no destination">Official source</span><span title="Mock link: no destination">HTML</span><span title="Mock link: no destination">PDF</span></p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AccessAndDemo() {
  return (
    <section id="access" className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-[1152px]">
        <Reveal><h2 className="text-[34px] font-semibold tracking-[-0.025em] sm:text-[44px]">Four ways to reach the corpus.</h2></Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {paths.map(([h, a, b, g], i) => (
            <Reveal key={h} delay={i * 70}>
              <article className="group h-full rounded-panel border border-border bg-surface p-6 transition-transform duration-300 ease-out hover:-translate-y-1">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 font-serif text-[24px] text-primary">{g}</div>
                <h3 className="mt-5 text-[18px] font-semibold">{h}</h3>
                <p className="mt-1 text-[15px]">{a}</p>
                <p className="mt-3 text-[14px] text-muted">{b}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <p className="mt-10 text-[15px] text-muted">Try the database claim <MockBadge>illustrative snippet</MockBadge></p>
        <pre className="mt-3 overflow-x-auto rounded-panel border border-[var(--code-border)] bg-[var(--code-bg)] p-4 font-mono text-[12.5px] leading-6">{sql}</pre>

        <dl className="mt-10 grid gap-6 sm:grid-cols-2">
          {details.map(([t, d]) => (
            <div key={t} className="border-t-2 border-foreground pt-3"><dt className="font-semibold">{t}</dt><dd className="mt-1 text-[15px] text-muted">{d}</dd></div>
          ))}
        </dl>

        <div id="api" className="mt-20">
          <h2 className="text-[34px] font-semibold tracking-[-0.025em] sm:text-[44px]">From key to cited law in one call.</h2>
          <div className="mt-6"><ApiDemo /></div>
          <ol className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-[15px] text-muted"><li>1. Get your key</li><li>→ 2. Call the endpoint</li><li>→ 3. Ship cited law</li></ol>
        </div>
      </div>
    </section>
  );
}
