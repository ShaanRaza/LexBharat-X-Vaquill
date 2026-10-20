"use client";
import { useEffect, useState } from "react";
import type { CaseItem } from "@/lib/judgments/types";

// Case metadata list for one court and year (Supreme Court only for now). Fetches /api/judgments/list. No judgment text.
type Resp = { available: boolean; results: CaseItem[]; total: number; page: number; pageSize: number; hasMore: boolean; note?: string };
const PAGE = 20;

export default function CaseList({ court, year }: { court: string; year: number }) {
  const [q, setQ] = useState(""); const [page, setPage] = useState(1);
  const [data, setData] = useState<Resp | null>(null); const [err, setErr] = useState("");
  useEffect(() => { setPage(1); }, [q]);
  useEffect(() => {
    const ac = new AbortController(), p = new URLSearchParams({ court, year: String(year), page: String(page), pageSize: String(PAGE) });
    if (q.trim().length >= 2) p.set("search", q.trim());
    setErr("");
    fetch(`/api/judgments/list?${p}`, { signal: ac.signal }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? String(r.status)); setData(j as Resp); })
      .catch((e) => { if ((e as Error).name !== "AbortError") { setErr((e as Error).message || "Could not load cases."); setData(null); } });
    return () => ac.abort();
  }, [court, year, q, page]);
  return (
    <div className="mt-5">
      <label htmlFor="case-q" className="sr-only">Search cases in {year}</label>
      <input id="case-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, parties or citation…" autoComplete="off"
        className="h-11 w-full rounded-xl bg-accent px-4 text-[15px] outline-none ring-1 ring-transparent placeholder:text-[#65625f] focus:bg-surface focus:ring-primary/50" />
      {err && <p role="alert" className="mt-4 rounded-lg border border-error/40 bg-error/5 p-3 text-[14px]">{err}</p>}
      {!data && !err && <div className="mt-4 space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="console-skel h-16 rounded-xl bg-accent" />)}</div>}
      {data && !data.available && <p className="mt-4 rounded-lg bg-accent px-4 py-3 text-[14px] text-[#535151]">{data.note}</p>}
      {data?.available && (
        <>
          <p className="mt-3 text-[13px] text-muted" role="status">{data.total.toLocaleString("en-IN")} case records in {year}</p>
          <ul className="mt-2 space-y-2">
            {data.results.map((c) => (
              <li key={c.caseId} className="rounded-xl bg-surface px-5 py-4 shadow-sm ring-1 ring-border/60">
                <p className="text-[15px] font-medium">{c.title}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[#535151]">
                  {c.decisionDate && <span className="rounded-md bg-accent px-2 py-0.5">{c.decisionDate.slice(0, 10)}</span>}
                  {c.disposition && <span className="rounded-md bg-accent px-2 py-0.5">{c.disposition}</span>}
                  {c.citation && <span>{c.citation}</span>}
                  {c.judges?.length ? <span>· {c.judges.join(", ")}</span> : null}
                  <span className="font-mono">· {c.caseId}</span>
                </p>
              </li>
            ))}
            {!data.results.length && <li className="rounded-xl border border-dashed border-border p-6 text-center text-[14px] text-muted">No cases match.</li>}
          </ul>
          <div className="mt-4 flex items-center justify-between text-[14px]">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-9 rounded-lg px-3 ring-1 ring-border hover:bg-accent disabled:opacity-40">← Previous</button>
            <span className="text-muted">Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
            <button type="button" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)} className="h-9 rounded-lg px-3 ring-1 ring-border hover:bg-accent disabled:opacity-40">Next →</button>
          </div>
        </>
      )}
    </div>
  );
}
