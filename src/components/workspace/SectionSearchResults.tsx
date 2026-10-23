"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Highlight, Notice, Panel } from "@/components/kit";
import { STATUS_INFO, INCOMPLETE_NOTICE, officialSourceUrl } from "@/lib/acts/quality";

// Results of the Acts-tab search box over the TEXT of Central and State Acts (GET /api/acts/search). Presentation and fetching only; the search itself lives in
// src/lib/acts/searchStore.ts. Colours, sizes and radii come from the tokens through Tailwind names and the shared kit.
type Hit = { actId: string; actTitle: string; year: number | null; category: string; state: string | null; sourceUrl: string | null; sectionKey: string; number: string | null; heading: string | null; chapter: string | null; status: keyof typeof STATUS_INFO; snippet: string; via: "text" | "lookup" };
type Resp = { searchAvailable: boolean; message?: string; results: Hit[]; total: number; totalCapped?: boolean; page: number; pageSize: number; hasMore: boolean; mode?: "text" | "lookup"; note?: string };
const label = (v: string) => v.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

export default function SectionSearchResults({ q }: { q: string }) {
  const [page, setPage] = useState(1), [data, setData] = useState<Resp | null>(null), [err, setErr] = useState(""), [retry, setRetry] = useState(0);
  useEffect(() => { setPage(1); }, [q]);
  useEffect(() => {
    const ac = new AbortController(), t = setTimeout(() => {
      setErr("");
      fetch(`/api/acts/search?q=${encodeURIComponent(q)}&page=${page}`, { signal: ac.signal }).then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : `Search failed (status ${r.status}).`);
        setData(j as Resp);
      }).catch((e) => { if ((e as Error).name !== "AbortError") { setErr((e as Error).message || "Search failed."); setData(null); } });
    }, 250);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q, page, retry]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <section aria-labelledby="sec-hits" className="mt-6">
      <h2 id="sec-hits" className="text-ui-lead font-semibold">Sections matching &ldquo;{q}&rdquo;{data?.searchAvailable && data.total > 0 ? <span className="ml-2 text-ui-base font-normal text-muted">{data.total.toLocaleString("en-IN")}{data.totalCapped ? "+" : ""} {data.total === 1 ? "section" : "sections"}</span> : null}</h2>
      {err && <Notice tone="bad" role="alert" className="mt-3"><p>{err}</p><button type="button" onClick={() => setRetry((n) => n + 1)} className="rounded-panel px-3 py-1 text-ui-base ring-1 ring-border hover:bg-accent">Try again</button></Notice>}
      {!data && !err && <div className="mt-3 space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="console-skel h-20 rounded-card bg-accent" />)}</div>}
      {data && !data.searchAvailable && <Notice tone="info" role="status" className="mt-3"><p><strong className="font-medium text-foreground">Section search is not available yet.</strong> {data.message ?? ""} Searching act titles below still works.</p></Notice>}
      {data?.searchAvailable && (
        <>
          {data.note && <p className="mt-1 text-ui-sm text-muted">{data.note}</p>}
          <ul className="mt-3 space-y-2">
            {data.results.map((h) => (
              <Panel as="li" key={`${h.actId}-${h.sectionKey}`} className="px-card py-4">
                <Link href={`/workspace/browse/acts/${h.actId}?section=${encodeURIComponent(h.sectionKey)}`} className="text-ui-body font-medium text-primary hover:underline">
                  {h.number ? `Section ${h.number}` : "Text block"}{h.heading ? ` — ${h.heading}` : ""}
                </Link>
                <p className="mt-0.5 text-ui-sm text-secondary">{h.actTitle}{h.chapter ? ` · ${h.chapter}` : ""}</p>
                {h.snippet && <p className="mt-2 text-ui-base leading-relaxed text-foreground"><Highlight snippet={h.snippet} /></p>}
                {h.status === "possibly_incomplete" && (
                  <Notice tone="warn" role="note" compact className="mt-2"><p><strong className="font-medium text-foreground">Possibly incomplete.</strong> {INCOMPLETE_NOTICE} <a className="font-medium underline" href={officialSourceUrl(h.sourceUrl)} target="_blank" rel="noopener noreferrer">Open on India Code</a></p></Notice>
                )}
                <p className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge>{label(h.category)}</Badge>{h.state && <Badge>{label(h.state)}</Badge>}{h.year !== null && <Badge>{h.year}</Badge>}
                  {h.via === "lookup" && <Badge tone="info">Section lookup</Badge>}
                  <Badge tone={STATUS_INFO[h.status].tone} title={STATUS_INFO[h.status].explain}>{STATUS_INFO[h.status].label}</Badge>
                </p>
              </Panel>
            ))}
            {!data.results.length && <li className="rounded-card border border-dashed border-border p-6 text-center text-ui-base text-muted">{data.note ?? "No section matches."}</li>}
          </ul>
          {data.total > data.pageSize && (
            <div className="mt-3 flex items-center justify-between text-ui-base">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-9 rounded-panel px-3 ring-1 ring-border hover:bg-accent disabled:opacity-40">← Previous</button>
              <span className="text-muted">Page {data.page} of {pages.toLocaleString("en-IN")}{data.totalCapped ? "+" : ""}</span>
              <button type="button" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)} className="h-9 rounded-panel px-3 ring-1 ring-border hover:bg-accent disabled:opacity-40">Next →</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
