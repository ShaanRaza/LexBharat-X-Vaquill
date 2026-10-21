"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import CopyButton from "./CopyButton";
import { displayDisposition } from "@/lib/judgments/disposition.mjs";

// Supreme Court cases across all years, found by words in the title (both parties) or the citation. Static index; not full-text search.
type Hit = { caseId: string; year: number; title: string; citation?: string; decisionDate?: string; disposition?: string };
type Resp = { results: Hit[]; total: number; page: number; pageSize: number; hasMore: boolean; note?: string };
const fmtDate = (d?: string) => (d ? new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null);

export default function ScSearchResults({ q }: { q: string }) {
  const [page, setPage] = useState(1); const [data, setData] = useState<Resp | null>(null); const [err, setErr] = useState(""); const [retry, setRetry] = useState(0);
  useEffect(() => { setPage(1); }, [q]);
  useEffect(() => {
    const ac = new AbortController(), t = setTimeout(() => {
      setErr("");
      fetch(`/api/judgments/search?q=${encodeURIComponent(q)}&page=${page}&pageSize=10`, { signal: ac.signal }).then(async (r) => { const j = await r.json().catch(() => null); if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : `Search failed (status ${r.status}). Please try again.`); setData(j as Resp); })
        .catch((e) => { if ((e as Error).name !== "AbortError") { setErr((e as Error).message || "Search failed."); setData(null); } });
    }, 250);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q, page, retry]);
  const chip = "rounded-md bg-accent px-2 py-0.5";
  return (
    <section aria-labelledby="sc-hits" className="mt-6">
      <h2 id="sc-hits" className="text-[18px] font-semibold">Supreme Court cases matching &ldquo;{q}&rdquo;</h2>
      <p className="mt-1 text-[13px] text-muted">Words in the case title (both parties) or the citation, all years, newest first. This is not a full-text search of judgments, and High Courts are not searched.</p>
      {err && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error/40 bg-error/5 p-3 text-[14px]"><span>{err}</span><button type="button" onClick={() => setRetry((n) => n + 1)} className="h-8 rounded-lg px-3 ring-1 ring-border hover:bg-accent">Try again</button></div>}
      {!data && !err && <div className="mt-3 space-y-2" aria-busy="true">{[0, 1].map((i) => <div key={i} className="console-skel h-14 rounded-xl bg-accent" />)}</div>}
      {data && (
        <>
          <p className="mt-3 text-[13px] text-muted" role="status">{data.total.toLocaleString("en-IN")} {data.total === 1 ? "case" : "cases"}</p>
          <ul className="mt-2 space-y-2">
            {data.results.map((c) => (
              <li key={c.caseId} className="relative rounded-xl bg-surface px-5 py-4 shadow-sm ring-1 ring-border/60 transition-colors hover:ring-primary/50">
                <Link href={`/workspace/browse/judgments/supreme-court-of-india/${c.year}/${encodeURIComponent(c.caseId)}`} className="text-[15px] font-medium text-primary after:absolute after:inset-0 after:rounded-xl after:content-['']">{c.title}</Link>
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[#535151]">
                  {fmtDate(c.decisionDate) && <span className={chip}>{fmtDate(c.decisionDate)}</span>}
                  {c.citation && <span className="relative z-10 inline-flex items-center gap-1.5"><code className="font-mono text-[12px] text-foreground">{c.citation}</code><CopyButton text={c.citation} label="Copy citation" /></span>}
                  {c.disposition && <span className={chip} title={`As recorded: ${c.disposition}`}>{displayDisposition(c.disposition)}</span>}
                  <span className="font-mono">· {c.caseId}</span>
                </p>
              </li>
            ))}
            {!data.results.length && <li className="rounded-xl border border-dashed border-border p-6 text-center text-[14px] text-muted">No Supreme Court case matches. Try fewer words or a party&apos;s surname.</li>}
          </ul>
          {data.total > data.pageSize && (
            <div className="mt-3 flex items-center justify-between text-[14px]">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-9 rounded-lg px-3 ring-1 ring-border hover:bg-accent disabled:opacity-40">← Previous</button>
              <span className="text-muted">Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
              <button type="button" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)} className="h-9 rounded-lg px-3 ring-1 ring-border hover:bg-accent disabled:opacity-40">Next →</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
