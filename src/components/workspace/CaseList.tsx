"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import CopyButton from "./CopyButton";
import type { CaseItem, Facet } from "@/lib/judgments/types";

// Case list for one court and year (newest first). Fetches /api/judgments/list. Metadata only, no judgment text.
// What a row shows is decided at export time (docs/JUDGMENTS-HC.md): parties, disposition chip, judges and bench size appear only where the data was
// verified, so a missing field here means "not reliable or not recorded", never an empty promise.
type Resp = { available: boolean; searchable?: boolean; filterable?: boolean; facets?: { disposition: Facet[]; bench?: Facet[] }; results: CaseItem[]; total: number; page: number; pageSize: number; hasMore: boolean; note?: string };
const PAGE = 20, HC_PAGE = 100; // the High Court export stores 100 cases per file; the detail link carries that file number
const fmtDate = (d?: string) => (d ? new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null);
const BENCH_FILTER: Record<string, string> = { single: "Single judge", division: "Division bench", larger: "Larger bench (3+ judges)" };
const benchLabel = (n: number) => (n === 1 ? "Single judge" : n === 2 ? "Division bench" : `${n}-judge bench`);

/** Headline = the case reference ("WP/933/2024"), parties line = "A v. B". Many titles already read "WP/933/2024 of A Vs B": then the reference is cut out of the title so the parties are not printed twice. */
function heads(c: CaseItem): { heading: string; parties: string | null } {
  const parties = c.petitioner && c.respondent ? `${c.petitioner} v. ${c.respondent}` : null;
  let heading = c.title ?? "";
  if (parties) {
    const cut = heading.indexOf(" of ");
    if (cut > 0 && cut <= 40 && c.petitioner && heading.toLowerCase().includes(c.petitioner.slice(0, 10).toLowerCase())) heading = heading.slice(0, cut);
    else if (c.petitioner && heading.toLowerCase().includes(c.petitioner.slice(0, 10).toLowerCase())) return { heading, parties: null };
  }
  if (!heading) heading = c.caseNumber ? `Case ${c.caseNumber}` : `Case record ${c.caseId}`;
  else if (/^\d+\s*(of|\/)\s*\d{4}$/i.test(heading)) heading = `Case ${heading}`;
  return { heading, parties };
}

export default function CaseList({ court, year, searchable, filterable, initialPage = 1 }: { court: string; year: number; searchable: boolean; filterable: boolean; initialPage?: number }) {
  const [q, setQ] = useState(""); const [disp, setDisp] = useState(""); const [bench, setBench] = useState(""); const [page, setPage] = useState(initialPage);
  const [data, setData] = useState<Resp | null>(null); const [err, setErr] = useState(""); const [retry, setRetry] = useState(0);
  useEffect(() => { if (q || disp || bench) setPage(1); }, [q, disp, bench]);
  useEffect(() => {
    const ac = new AbortController(), p = new URLSearchParams({ court, year: String(year), page: String(page), pageSize: String(PAGE) });
    if (q.trim().length >= 2) p.set("search", q.trim());
    if (disp) p.set("disposition", disp);
    if (bench) p.set("bench", bench);
    setErr("");
    fetch(`/api/judgments/list?${p}`, { signal: ac.signal }).then(async (r) => { const j = await r.json().catch(() => null); if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : `The server could not load these cases (status ${r.status}). Please try again.`); if (!j) throw new Error("The server sent an unreadable response. Please try again."); setData(j as Resp); })
      .catch((e) => { if ((e as Error).name !== "AbortError") { setErr((e as Error).message || "Could not load cases."); setData(null); } });
    return () => ac.abort();
  }, [court, year, q, disp, bench, page, retry]);
  const field = "h-11 rounded-xl bg-accent px-4 text-[15px] outline-none ring-1 ring-transparent placeholder:text-[#65625f] focus:bg-surface focus:ring-primary/50";
  return (
    <div className="mt-5">
      {(searchable || filterable) && (
        <div className="flex flex-wrap items-center gap-3">
          {searchable && <><label htmlFor="case-q" className="sr-only">Search cases in {year}</label>
            <input id="case-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, parties or citation…" autoComplete="off" className={`${field} min-w-[240px] flex-1`} /></>}
          {filterable && data?.facets?.disposition.length ? <><label htmlFor="case-disp" className="sr-only">Disposition</label>
            <select id="case-disp" value={disp} onChange={(e) => { setDisp(e.target.value); setBench(""); }} className={field}><option value="">Any disposition</option>{data.facets.disposition.map((f) => <option key={f.value} value={f.value}>{f.value} ({f.count.toLocaleString("en-IN")})</option>)}</select></> : null}
          {filterable && data?.facets?.bench?.length ? <><label htmlFor="case-bench" className="sr-only">Bench size</label>
            <select id="case-bench" value={bench} onChange={(e) => { setBench(e.target.value); setDisp(""); }} className={field}><option value="">Any bench size</option>{data.facets.bench.map((f) => <option key={f.value} value={f.value}>{BENCH_FILTER[f.value] ?? f.value} ({f.count.toLocaleString("en-IN")})</option>)}</select></> : null}
        </div>
      )}
      {!searchable && <p className={`${searchable || filterable ? "mt-3 " : ""}rounded-lg bg-accent px-4 py-2.5 text-[13px] text-[#535151]`}>Newest first.{filterable ? " Filters apply one at a time. Bench size is offered only for courts whose judge data is reliable." : " Filters are not available for this court yet."} Searching by party name is not available for High Courts yet: a year can hold over a hundred thousand cases and there is no search index. Short text previews are not available yet. High Court records usually have a case number but no reporter citation.</p>}
      {err && <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error/40 bg-error/5 p-3 text-[14px]"><span>{err}</span><button type="button" onClick={() => setRetry((n) => n + 1)} className="h-8 rounded-lg px-3 ring-1 ring-border hover:bg-accent">Try again</button></div>}
      {!data && !err && <div className="mt-4 space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="console-skel h-16 rounded-xl bg-accent" />)}</div>}
      {data && !data.available && <p className="mt-4 rounded-lg bg-accent px-4 py-3 text-[14px] text-[#535151]">{data.note}</p>}
      {data?.available && (
        <>
          <p className="mt-3 text-[13px] text-muted" role="status">{data.total.toLocaleString("en-IN")} case records in {year}{q.trim().length >= 2 || disp || bench ? " match" : ""}</p>
          <ul className="mt-2 space-y-2">
            {data.results.map((c, idx) => {
              const hcPage = c.mainPage ?? Math.floor(((page - 1) * PAGE + idx) / HC_PAGE) + 1, { heading, parties } = heads(c), date = fmtDate(c.decisionDate);
              const href = `/workspace/browse/judgments/${court}/${year}/${encodeURIComponent(c.caseId)}?p=${hcPage}&lp=${page}`;
              const chip = "rounded-md bg-accent px-2 py-0.5";
              return (
                <li key={c.caseId} className="relative rounded-xl bg-surface px-5 py-4 shadow-sm ring-1 ring-border/60 transition-colors hover:ring-primary/50">
                    {/* the title link stretches over the whole row; the copy button sits above it */}
                    <Link href={href} className="text-[15px] font-medium text-primary after:absolute after:inset-0 after:rounded-xl after:content-['']">{heading}</Link>
                    {parties && <p className="mt-1 text-[14px] text-foreground/80">{parties}</p>}
                    {c.judges?.length ? <p className="mt-1 text-[13px] italic text-[#535151]">{c.judges.join(", ")}</p> : null}
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[#535151]">
                      <span className={chip}>{date ?? "No decision date recorded"}</span>
                      {c.citation && <span className="relative z-10 inline-flex items-center gap-1.5"><code className="font-mono text-[12px] text-foreground">{c.citation}</code><CopyButton text={c.citation} label="Copy citation" /></span>}
                      {(c.dispositionLabel ?? (court === "supreme-court-of-india" ? c.disposition : undefined)) && <span className={chip}>{c.dispositionLabel ?? c.disposition}</span>}
                      {c.benchSize ? <span className={chip}>{benchLabel(c.benchSize)}</span> : null}
                      {c.caseNumber && <span>Case no. {c.caseNumber}</span>}
                      {c.pages ? <span>· {c.pages} {c.pages === 1 ? "page" : "pages"}</span> : null}
                      <span className="font-mono">· {c.caseId}</span>
                    </p>
                </li>
              );
            })}
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
