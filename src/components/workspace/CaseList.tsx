"use client";
import { useEffect, useState } from "react";
import CaseRow from "./CaseRow";
import SearchField from "./SearchField";
import type { CaseItem, Facet } from "@/lib/judgments/types";

// Case list for one court and year (newest first), with the shared search bar. Metadata only, no judgment text.
// Search: Supreme Court = words in title/parties/citation inside the year (/api/judgments/list); High Courts = party names and case numbers from the static index
// (/api/judgments/search-hc), this year or all years of the court. What a row shows is decided at export time (docs/JUDGMENTS-HC.md).
const SC = "supreme-court-of-india";
type Resp = { available: boolean; facets?: { disposition: Facet[]; bench?: Facet[] }; results: (CaseItem & { year?: number; mainPage?: number })[]; total: number; page: number; pageSize: number; hasMore: boolean; note?: string };
const PAGE = 20, HC_PAGE = 100;   // the High Court export stores 100 cases per file; the detail link carries that file number
const BENCH_FILTER: Record<string, string> = { single: "Single judge", division: "Division bench", larger: "Larger bench (3+ judges)" };

export default function CaseList({ court, year, courtName, searchable, filterable, initialPage = 1 }: { court: string; year: number; courtName?: string; searchable: boolean; filterable: boolean; initialPage?: number }) {
  const isHc = court !== SC;
  const [q, setQ] = useState(""); const [scope, setScope] = useState<"year" | "all">("year"); const [disp, setDisp] = useState(""); const [bench, setBench] = useState(""); const [page, setPage] = useState(initialPage);
  const [data, setData] = useState<Resp | null>(null); const [err, setErr] = useState(""); const [retry, setRetry] = useState(0);
  const searching = searchable && q.trim().length >= 2, hcSearch = searching && isHc;
  useEffect(() => { if (q || disp || bench) setPage(1); }, [q, scope, disp, bench]);
  useEffect(() => {
    const ac = new AbortController(), term = q.trim();
    const t = setTimeout(() => {
      const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE) });
      let url: string;
      if (hcSearch) { p.set("q", term); p.set("court", court); if (scope === "year") p.set("year", String(year)); url = `/api/judgments/search-hc?${p}`; }
      else { p.set("court", court); p.set("year", String(year)); if (searching) p.set("search", term); if (disp) p.set("disposition", disp); if (bench) p.set("bench", bench); url = `/api/judgments/list?${p}`; }
      setErr("");
      fetch(url, { signal: ac.signal }).then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : `The server could not load these cases (status ${r.status}). Please try again.`);
        if (!j) throw new Error("The server sent an unreadable response. Please try again.");
        setData(hcSearch ? ({ available: j.indexAvailable, results: j.results, total: j.total, page: j.page, pageSize: j.pageSize, hasMore: j.hasMore, note: j.indexAvailable ? j.note : "High Court name search is not available on this site yet. Browse the court by year instead." } as Resp) : (j as Resp));
      }).catch((e) => { if ((e as Error).name !== "AbortError") { setErr((e as Error).message || "Could not load cases."); setData(null); } });
    }, q ? 250 : 0);
    return () => { clearTimeout(t); ac.abort(); };
  }, [court, year, q, scope, disp, bench, page, retry, hcSearch, searching]);
  const field = "h-11 rounded-xl bg-accent px-4 text-[15px] outline-none ring-1 ring-transparent focus:bg-surface focus:ring-primary/50";
  const facets = hcSearch ? undefined : data?.facets;
  return (
    <div className="mt-5">
      {searchable && <SearchField id="case-q" value={q} onChange={setQ} label={`Search ${courtName ?? "cases"}`} placeholder={isHc ? "Try a petitioner or respondent name, or a case number like 933/2024" : "Try a party name, a title word or a citation"} />}
      {searchable && isHc && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#535151]">
        <span role="group" aria-label="Where to search" className="inline-flex overflow-hidden rounded-lg ring-1 ring-border">
          {([["year", `${year} only`], ["all", "All years"]] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={scope === v} onClick={() => setScope(v)} className={`px-3 py-1 ${scope === v ? "bg-primary text-white" : "hover:bg-accent"}`}>{l}</button>)}
        </span>
        <span>Searches party names and case numbers as recorded in the dataset, not judgment text.</span>
      </div>}
      {searchable && !isHc && <p className="mt-2 text-[13px] text-[#535151]">Searches the title (both parties) and citation within {year}, not judgment text.</p>}
      {(filterable && !hcSearch && (facets?.disposition.length || facets?.bench?.length)) ? (
        <div className="mt-3 flex flex-wrap gap-3">
          {facets?.disposition.length ? <><label htmlFor="case-disp" className="sr-only">Disposition</label>
            <select id="case-disp" value={disp} onChange={(e) => { setDisp(e.target.value); setBench(""); }} className={field}><option value="">Any disposition</option>{facets.disposition.map((f) => <option key={f.value} value={f.value}>{f.value} ({f.count.toLocaleString("en-IN")})</option>)}</select></> : null}
          {facets?.bench?.length ? <><label htmlFor="case-bench" className="sr-only">Bench size</label>
            <select id="case-bench" value={bench} onChange={(e) => { setBench(e.target.value); setDisp(""); }} className={field}><option value="">Any bench size</option>{facets.bench.map((f) => <option key={f.value} value={f.value}>{BENCH_FILTER[f.value] ?? f.value} ({f.count.toLocaleString("en-IN")})</option>)}</select></> : null}
        </div>
      ) : null}
      {!searchable && <p className="mt-3 rounded-lg bg-accent px-4 py-2.5 text-[13px] text-[#535151]">Newest first.{filterable ? " Filters apply one at a time. Bench size is offered only for courts whose judge data is reliable." : " Filters are not available for this court yet."} Searching by party name is not available for High Courts on this site yet: it needs the High Court search index, which is not loaded here. Short text previews are not available yet. High Court records usually have a case number but no reporter citation.</p>}
      {err && <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error/40 bg-error/5 p-3 text-[14px]"><span>{err}</span><button type="button" onClick={() => setRetry((n) => n + 1)} className="h-8 rounded-lg px-3 ring-1 ring-border hover:bg-accent">Try again</button></div>}
      {!data && !err && <div className="mt-4 space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="console-skel h-16 rounded-xl bg-accent" />)}</div>}
      {data && !data.available && <p className="mt-4 rounded-lg bg-accent px-4 py-3 text-[14px] text-[#535151]">{data.note}</p>}
      {data?.available && (
        <>
          <p className="mt-3 text-[13px] text-muted" role="status">{hcSearch ? `${data.total.toLocaleString("en-IN")} ${data.total === 1 ? "case matches" : "cases match"} “${q.trim()}” ${scope === "year" ? `in ${year}` : `across all years of ${courtName ?? "this court"}`}` : `${data.total.toLocaleString("en-IN")} case records in ${year}${searching || disp || bench ? " match" : ""}`}</p>
          <ul className="mt-2 space-y-2">
            {data.results.map((c, idx) => {
              const y = c.year ?? year, p = c.mainPage ?? Math.floor(((page - 1) * PAGE + idx) / HC_PAGE) + 1;
              return <CaseRow key={`${y}-${c.caseId}`} c={c} court={court} year={hcSearch && scope === "all" ? y : undefined} courtName={hcSearch && scope === "all" ? undefined : undefined}
                href={`/workspace/browse/judgments/${court}/${y}/${encodeURIComponent(c.caseId)}?p=${p}&lp=${page}`} />;
            })}
            {!data.results.length && <li className="rounded-xl border border-dashed border-border p-6 text-center text-[14px] text-muted">{searching ? "No case matches. Try a surname, fewer words, or search all years." : "No cases match."}</li>}
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
