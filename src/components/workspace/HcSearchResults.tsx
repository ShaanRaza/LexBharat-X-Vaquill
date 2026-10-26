"use client";
import { useEffect, useState } from "react";
import CaseRow from "./CaseRow";
import type { CaseItem } from "@/lib/judgments/types";

// High Court cases across all years and courts, by party name or case number (static index; not judgment text). Newest first.
type Hit = CaseItem & { court: string; courtName: string; year: number; mainPage: number };
type Resp = { indexAvailable: boolean; results: Hit[]; total: number; page: number; pageSize: number; hasMore: boolean; note?: string };

export default function HcSearchResults({ q, court }: { q: string; court?: string }) {
  const [page, setPage] = useState(1); const [data, setData] = useState<Resp | null>(null); const [err, setErr] = useState(""); const [retry, setRetry] = useState(0);
  useEffect(() => { setPage(1); }, [q]);
  useEffect(() => {
    const ac = new AbortController(), t = setTimeout(() => {
      setErr("");
      fetch(`/api/judgments/search-hc?q=${encodeURIComponent(q)}${court ? `&court=${court}` : ""}&page=${page}&pageSize=10`, { signal: ac.signal }).then(async (r) => { const j = await r.json().catch(() => null); if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : `Search failed (status ${r.status}). Please try again.`); setData(j as Resp); })
        .catch((e) => { if ((e as Error).name !== "AbortError") { setErr((e as Error).message || "Search failed."); setData(null); } });
    }, 250);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q, court, page, retry]);
  return (
    <section aria-labelledby="hc-hits" className="mt-6">
      <h2 id="hc-hits" className="text-fs-xl font-semibold">High Court cases{data?.indexAvailable ? <span className="ml-2 text-fs-ui font-normal text-muted">{data.total.toLocaleString("en-IN")} {data.total === 1 ? "case" : "cases"}</span> : null}</h2>
      {err && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error/40 bg-error/5 p-3 text-fs-ui"><span>{err}</span><button type="button" onClick={() => setRetry((n) => n + 1)} className="h-8 rounded-lg px-3 ring-1 ring-border hover:bg-accent">Try again</button></div>}
      {!data && !err && <div className="mt-3 space-y-2" aria-busy="true">{[0, 1].map((i) => <div key={i} className="console-skel h-14 rounded-xl bg-accent" />)}</div>}
      {data && !data.indexAvailable && <p className="mt-3 rounded-lg bg-accent px-4 py-3 text-fs-ui text-secondary">High Court name search is not available on this site yet: it needs the High Court search index, which is not loaded here. You can still open any High Court and year from the list below.</p>}
      {data?.indexAvailable && (
        <>
          <ul className="mt-2 space-y-2">
            {data.results.map((c) => <CaseRow key={`${c.court}-${c.year}-${c.caseId}`} c={c} court={c.court} courtName={c.courtName} year={c.year} href={`/workspace/browse/judgments/${c.court}/${c.year}/${encodeURIComponent(c.caseId)}?p=${c.mainPage}`} />)}
            {!data.results.length && <li className="rounded-xl border border-dashed border-border p-6 text-center text-fs-ui text-muted">No High Court case matches. Try a surname or a case number such as 933/2024.</li>}
          </ul>
          {data.total > data.pageSize && (
            <div className="mt-3 flex items-center justify-between text-fs-ui">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-9 rounded-lg px-3 ring-1 ring-border hover:bg-accent disabled:opacity-40">← Previous</button>
              <span className="text-muted">Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize)).toLocaleString("en-IN")}</span>
              <button type="button" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)} className="h-9 rounded-lg px-3 ring-1 ring-border hover:bg-accent disabled:opacity-40">Next →</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
