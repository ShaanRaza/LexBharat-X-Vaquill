"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CaseRow from "./CaseRow";
import SearchField from "./SearchField";
import { displayDisposition } from "@/lib/judgments/disposition.mjs";
import type { CaseItem, Facet } from "@/lib/judgments/types";

// Case list for one court and year (newest first), with the shared search bar. Metadata only, no judgment text.
// Search (same bar and same "this year / all years" toggle on every court): Supreme Court = words in title, parties, citation and case number, in the year
// (/api/judgments/list) or in all years (/api/judgments/search); High Courts = party names, case numbers and case years from the static index (/api/judgments/search-hc). What a row shows is decided at export time (docs/JUDGMENTS-HC.md).
const SC = "supreme-court-of-india";
type Resp = { available: boolean; facets?: { disposition: Facet[]; bench?: Facet[] }; results: (CaseItem & { year?: number; mainPage?: number })[]; total: number; page: number; pageSize: number; hasMore: boolean; note?: string };
const PAGE = 20, HC_PAGE = 100;   // the High Court export stores 100 cases per file; the detail link carries that file number
/** Page numbers to show: first, last and a window around the current page; 0 marks a gap. */
const pageList = (cur: number, last: number): number[] => {
  const set = new Set([1, last, cur - 1, cur, cur + 1]); const out: number[] = [];
  for (const n of [...set].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b)) { if (out.length && n - out[out.length - 1] > 1) out.push(0); out.push(n); }
  return out;
};
const BENCH_FILTER: Record<string, string> = { single: "Single judge", division: "Division bench", larger: "Larger bench (3+ judges)" };

export default function CaseList({ court, year, courtName, searchable, filterable, initialPage = 1 }: { court: string; year: number; courtName?: string; searchable: boolean; filterable: boolean; initialPage?: number }) {
  const isHc = court !== SC;
  const [q, setQ] = useState(""); const [disp, setDisp] = useState(""); const [bench, setBench] = useState("");
  // Scope and page live in the URL (?years=all&page=3) so refresh, back and shared links keep them; initialPage is the server-rendered value of the same param.
  const router = useRouter(), pathname = usePathname(), sp = useSearchParams(), scope: "year" | "all" = sp.get("years") === "all" ? "all" : "year";
  const page = Math.max(1, Math.floor(Number(sp.get("page"))) || initialPage);
  const go = (next: { all?: boolean; page?: number }, replace = false) => {
    const all = next.all ?? scope === "all", pg = next.page ?? page, u = `${pathname}?year=${year}${all ? "&years=all" : ""}${pg > 1 ? `&page=${pg}` : ""}`;
    replace ? router.replace(u, { scroll: false }) : router.push(u, { scroll: false });
  };
  const setPage = (f: (p: number) => number) => go({ page: f(page) });
  const setScope = (v: "year" | "all") => { setDisp(""); setBench(""); go({ all: v === "all", page: 1 }); };
  const [data, setData] = useState<Resp | null>(null); const [err, setErr] = useState(""); const [retry, setRetry] = useState(0);
  const searching = searchable && q.trim().length >= 2, hcSearch = searching && isHc, scAll = searching && !isHc && scope === "all", browseAll = !searching && scope === "all", cross = hcSearch || scAll || browseAll;
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } if (page > 1) go({ page: 1 }, true); }, [q, disp, bench]);   // a new query or filter starts at page 1
  useEffect(() => {
    const ac = new AbortController(), term = q.trim();
    const t = setTimeout(() => {
      const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE) });
      let url: string;
      if (scAll) { p.set("q", term); url = `/api/judgments/search?${p}`; }
      else if (hcSearch) { p.set("q", term); p.set("court", court); if (scope === "year") p.set("year", String(year)); url = `/api/judgments/search-hc?${p}`; }
      else if (browseAll) { p.set("court", court); p.set("years", "all"); url = `/api/judgments/list?${p}`; }
      else { p.set("court", court); p.set("year", String(year)); if (searching) p.set("search", term); if (disp) p.set("disposition", disp); if (bench) p.set("bench", bench); url = `/api/judgments/list?${p}`; }
      setErr("");
      fetch(url, { signal: ac.signal }).then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : `The server could not load these cases (status ${r.status}). Please try again.`);
        if (!j) throw new Error("The server sent an unreadable response. Please try again.");
        if (scAll) setData({ available: true, results: j.results.map((h: Record<string, string | number>) => ({ caseId: h.caseId, title: h.title, citation: h.citation, decisionDate: h.decisionDate, disposition: h.disposition, dispositionLabel: displayDisposition(h.disposition as string), caseNumberExtracted: h.caseNumber, year: h.year })), total: j.total, page: j.page, pageSize: j.pageSize, hasMore: j.hasMore } as Resp);
        else setData(hcSearch ? ({ available: j.indexAvailable, results: j.results, total: j.total, page: j.page, pageSize: j.pageSize, hasMore: j.hasMore, note: j.indexAvailable ? j.note : "High Court name search is not available on this site yet. Browse the court by year instead." } as Resp) : (j as Resp));
      }).catch((e) => { if ((e as Error).name !== "AbortError") { setErr((e as Error).message || "Could not load cases."); setData(null); } });
    }, q ? 250 : 0);
    return () => { clearTimeout(t); ac.abort(); };
  }, [court, year, q, scope, disp, bench, page, retry, hcSearch, scAll, browseAll, searching]);
  const field = "h-11 rounded-xl bg-accent px-4 text-[15px] outline-none ring-1 ring-transparent focus:bg-surface focus:ring-primary/50";
  const facets = cross ? undefined : data?.facets, pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <div className="mt-5">
      {searchable && <SearchField id="case-q" value={q} onChange={setQ} label={`Search ${courtName ?? "cases"}`} placeholder={isHc ? "Try a petitioner or respondent name, a case number like 933/2024, or a year" : "Try a party name, a title word, a citation or a case number like 5491/2024"} />}
      {(searchable || filterable) && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#535151]">
        <span role="group" aria-label="Where to search" className="inline-flex overflow-hidden rounded-lg ring-1 ring-border">
          {([["year", `${year} only`], ["all", "All years"]] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={scope === v} onClick={() => setScope(v)} className={`px-3 py-1 ${scope === v ? "bg-primary text-white" : "hover:bg-accent"}`}>{l}</button>)}
        </span>
        {searchable && <span>{isHc ? "Searches party names, case numbers and case years as recorded in the dataset, not judgment text." : "Searches the title (both parties), citation and case number from the judgment heading, not judgment text."}</span>}
      </div>}
      {(filterable && !cross && (facets?.disposition.length || facets?.bench?.length)) ? (
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
          <p className="mt-3 text-[13px] text-muted" role="status">{cross && !browseAll ? `${data.total.toLocaleString("en-IN")} ${data.total === 1 ? "case matches" : "cases match"} “${q.trim()}” ${scope === "year" ? `in ${year}` : `across all years of ${courtName ?? "this court"}`}` : `${data.total.toLocaleString("en-IN")} case records ${browseAll ? "across all years" : `in ${year}`}${searching || disp || bench ? " match" : ""}`}</p>
          <ul className="mt-2 space-y-2">
            {data.results.map((c, idx) => {
              const y = c.year ?? year, p = c.mainPage ?? Math.floor(((page - 1) * PAGE + idx) / HC_PAGE) + 1;
              return <CaseRow key={`${y}-${c.caseId}`} c={c} court={court} year={scope === "all" ? y : undefined}
                href={`/workspace/browse/judgments/${court}/${y}/${encodeURIComponent(c.caseId)}?p=${p}&lp=${page}${scope === "all" ? "&ya=1" : ""}`} />;
            })}
            {!data.results.length && <li className="rounded-xl border border-dashed border-border p-6 text-center text-[14px] text-muted">{searching ? "No case matches. Try a surname, fewer words, or search all years." : "No cases match."}</li>}
          </ul>
          <nav aria-label="Pagination" className="mt-4 text-[14px]">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-9 rounded-lg px-3 ring-1 ring-border hover:bg-accent disabled:opacity-40">← Previous</button>
              {pageList(page, pages).map((n, i) => n === 0 ? <span key={`g${i}`} aria-hidden className="px-1 text-muted">…</span>
                : <button key={n} type="button" aria-current={n === page ? "page" : undefined} onClick={() => go({ page: n })} className={`h-9 min-w-9 rounded-lg px-2 ring-1 ring-border ${n === page ? "bg-primary text-white" : "hover:bg-accent"}`}>{n}</button>)}
              <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="h-9 rounded-lg px-3 ring-1 ring-border hover:bg-accent disabled:opacity-40">Next →</button>
            </div>
            <p className="mt-2 text-center text-muted">Page {Math.min(page, pages).toLocaleString("en-IN")} of {pages.toLocaleString("en-IN")} · {data.total.toLocaleString("en-IN")} {data.total === 1 ? "case" : "cases"} ({scope === "all" ? "all years" : year})</p>
          </nav>
        </>
      )}
    </div>
  );
}
