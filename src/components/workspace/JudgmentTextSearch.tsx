"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Highlight, Notice, Panel, Toggle } from "@/components/kit";

// Search INSIDE Supreme Court judgment text (GET /api/judgments/search-text): by meaning (default) or by words. Presentation and fetching only; the search lives in src/lib/judgments/scText.ts.
// Colours, sizes and radii come from the tokens through Tailwind names and the shared kit.
type Hit = { caseId: string; year: number; title: string; citation: string | null; decisionDate: string | null; disposition: string | null; chunk: number; page: number | null; passage: string; count: number | null };
type Resp = { available: boolean; message?: string; results: Hit[]; total: number; page: number; pageSize: number; hasMore: boolean; mode?: "meaning" | "words"; modes?: { meaning: boolean; words: boolean }; note?: string };

export default function JudgmentTextSearch({ q }: { q: string }) {
  const [mode, setMode] = useState<"meaning" | "words">("meaning"), [page, setPage] = useState(1), [data, setData] = useState<Resp | null>(null), [err, setErr] = useState(""), [retry, setRetry] = useState(0);
  useEffect(() => { setPage(1); }, [q, mode]);
  useEffect(() => {
    const ac = new AbortController(), t = setTimeout(() => {
      setErr("");
      fetch(`/api/judgments/search-text?q=${encodeURIComponent(q)}&mode=${mode}&page=${page}`, { signal: ac.signal }).then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : `Search failed (status ${r.status}).`);
        setData(j as Resp);
      }).catch((e) => { if ((e as Error).name !== "AbortError") { setErr((e as Error).message || "Search failed."); setData(null); } });
    }, 400);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q, mode, page, retry]);
  if (data && !data.available && !err) return null;   // not set up here: show nothing rather than a dead panel
  return (
    <section aria-labelledby="jt-hits" className="mt-8">
      <h2 id="jt-hits" className="text-ui-lead font-semibold">Inside Supreme Court judgments{data?.available && data.total > 0 ? <span className="ml-2 text-ui-base font-normal text-muted">{data.total.toLocaleString("en-IN")}{data.mode === "meaning" ? "" : ""} {data.total === 1 ? "judgment" : "judgments"}</span> : null}</h2>
      <Toggle label="How to search judgment text" className="mt-2" value={mode} onChange={(k) => { setData(null); setMode(k); }} options={[["meaning", "By meaning"], ["words", "By words"]] as const} />
      {err && <Notice tone="bad" role="alert" className="mt-3"><p>{err}</p><button type="button" onClick={() => setRetry((n) => n + 1)} className="rounded-button px-3 py-1 text-ui-base ring-1 ring-control-border hover:bg-accent">Try again</button></Notice>}
      {!data && !err && <div className="mt-3 space-y-2" aria-busy="true">{[0, 1].map((i) => <div key={i} className="console-skel h-20 rounded-card bg-accent" />)}</div>}
      {data?.available && (
        <>
          {data.note && <p className="mt-1 text-ui-sm text-muted">{data.note}</p>}
          <ul className="mt-3 space-y-2">
            {data.results.map((h) => (
              <Panel as="li" key={h.caseId} className="px-card py-4">
                <Link href={`/judgments/supreme-court-of-india/${h.year}/${encodeURIComponent(h.caseId)}#passage-${h.chunk}`} className="text-ui-body font-medium text-primary hover:underline">{h.title}</Link>
                <p className="mt-0.5 text-ui-sm text-secondary">{h.citation ?? h.caseId}{h.decisionDate ? ` · ${h.decisionDate}` : ""}{h.page ? ` · page ${h.page}` : ""}</p>
                <p className="mt-2 text-ui-base leading-relaxed text-foreground"><Highlight snippet={h.passage} /></p>
                <p className="mt-2 flex flex-wrap items-center gap-1.5">
                  {h.disposition && <Badge>{h.disposition}</Badge>}
                  <Badge tone="info" title="Found in the text of the judgment">{data.mode === "meaning" ? "By meaning" : `Words found${h.count ? ` ${h.count}×` : ""}`}</Badge>
                </p>
              </Panel>
            ))}
            {!data.results.length && <li className="rounded-card border border-dashed border-border p-6 text-center text-ui-base text-muted">No judgment matches. Try other words, or search by meaning.</li>}
          </ul>
          {data.total > data.pageSize && (
            <div className="mt-3 flex items-center justify-between text-ui-base">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-9 rounded-button px-3 ring-1 ring-control-border hover:bg-accent disabled:opacity-40">← Previous</button>
              <span className="text-muted">Page {data.page}</span>
              <button type="button" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)} className="h-9 rounded-button px-3 ring-1 ring-control-border hover:bg-accent disabled:opacity-40">Next →</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
