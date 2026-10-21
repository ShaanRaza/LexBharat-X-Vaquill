"use client";
import Link from "next/link";
import ScSearchResults from "./ScSearchResults";
import { useEffect, useMemo, useState } from "react";
import { ACT_CATEGORIES, ACT_STATUSES, ALL_COURTS, BROWSE_STATS, HIGH_COURTS, SUPREME_COURT, type ActItem, type Court } from "@/data/workspaceBrowse";

// "Browse Laws & Judgments" (layout recreated from a screenshot of the original app). Judgments tab: court cards from display data (not live).
// Acts tab: a client fetch of /api/acts/list, which serves real act-level legislation metadata (open-india-law, CC BY 4.0) unless ACTS_SOURCE=mock,
// in which case the response says source "mock" and this page labels itself accordingly (docs/ACTS-AND-JUDGMENTS.md, docs/ACTS-PHASE1.md).

const BANK = "M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18";
const Svg = ({ d, size = 16 }: { d: string; size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

function CourtCard({ c, featured, real, countsOnly }: { c: Court; featured?: boolean; real?: boolean; countsOnly?: boolean }) {
  return (
    <Link href={`/workspace/browse/judgments/${c.slug}`} className={`group flex items-center gap-4 rounded-xl bg-surface px-5 py-4 shadow-sm ring-1 transition-colors hover:ring-primary/50 ${featured ? "ring-primary/30" : "ring-border/70"}`}>
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent text-muted"><Svg d={BANK} size={22} /></span>
      <span className="min-w-0 flex-1 leading-snug">
        <span className="block text-[15px] font-medium text-primary">{c.name}</span>
        <span className="block text-[13px] text-muted">{c.count ? `${c.count} ${real ? "case records" : "judgments"}${countsOnly ? " (counts by year only)" : ""}` : "Count not captured"}</span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
    </Link>
  );
}

type ActsResponse = { source?: "real" | "mock"; results: ActItem[]; total: number; page: number; pageSize: number; hasMore: boolean; note?: string };
type CourtsResp = { source: "real" | "mock"; stats: { totalCases: number | null; listableCourts: number }; courts: { slug: string; cases: number | null; listable?: boolean }[] };
type ActsStats = { scope?: string; source: "real" | "mock"; acts: number; sections: number; categories: string[]; statuses: string[]; states?: string[]; departments?: string[]; caveats: string[]; attribution?: { text: string; url: string; licence: string; snapshot: string } };
const fmt = (n: number) => n.toLocaleString("en-IN");
// Display labels only: query values stay the raw slugs (state=west-bengal, department=sebi, status=in_force).
const ACRONYMS: Record<string, string> = { sebi: "SEBI", rbi: "RBI", mca: "MCA", dgft: "DGFT", trai: "TRAI", moefcc: "MoEFCC", cpcb: "CPCB", irdai: "IRDAI", dfs: "DFS", cbic: "CBIC" };
const label = (v: string) => ACRONYMS[v] ?? (v.includes("_") ? v.replace(/_/g, " ") : v.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "));
/** Reads an error message from a failed response without throwing on non-JSON bodies (gateway pages, empty bodies). */
async function readJson(r: Response): Promise<Record<string, unknown>> {
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : `The server could not load this list (status ${r.status}). Please try again.`);
  if (!j) throw new Error("The server sent an unreadable response. Please try again.");
  return j;
}
const PAGE = 8;

export default function BrowseLaws({ initialTab }: { initialTab: "judgments" | "acts" }) {
  const [tab, setTab] = useState(initialTab);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [state, setState] = useState("");
  const [dept, setDept] = useState("");
  const [retry, setRetry] = useState(0);
  const [sort, setSort] = useState("year_desc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ActsResponse | null>(null);
  const [err, setErr] = useState("");
  const [stats, setStats] = useState<ActsStats | null>(null);
  const [jc, setJc] = useState<CourtsResp | null>(null);

  useEffect(() => { fetch("/api/judgments/courts").then((r) => (r.ok ? r.json() : null)).then((j) => setJc(j as CourtsResp | null)).catch(() => setJc(null)); }, []);
  useEffect(() => { fetch("/api/acts/stats").then((r) => (r.ok ? r.json() : null)).then((j) => setStats(j as ActsStats | null)).catch(() => setStats(null)); }, []);

  useEffect(() => { setPage(1); }, [q, category, status, state, dept, sort]);
  useEffect(() => {
    if (tab !== "acts") return;
    const ac = new AbortController();
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE), sort });
    if (category) p.set("category", category);
    if (status) p.set("status", status);
    if (state) p.set("state", state);
    if (dept) p.set("department", dept);
    if (q.trim().length >= 2) p.set("search", q.trim());
    setErr("");
    fetch(`/api/acts/list?${p}`, { signal: ac.signal }).then(async (r) => { setData((await readJson(r)) as unknown as ActsResponse); })
      .catch((e) => { if ((e as Error).name !== "AbortError") { setErr((e as Error).message || "Could not load acts."); setData(null); } });
    return () => ac.abort();
  }, [tab, q, category, status, state, dept, sort, page, retry]);

  const real = stats?.source === "real";
  const categories = stats?.categories ?? [...ACT_CATEGORIES], statuses = stats?.statuses ?? [...ACT_STATUSES];
  const jreal = jc?.source === "real";
  const countsOnly = (c: Court) => jreal && jc?.courts.find((x) => x.slug === c.slug)?.listable === false;
  const withCount = (c: Court): Court => { const n = jreal ? jc?.courts.find((x) => x.slug === c.slug)?.cases : null; return n != null ? { ...c, count: fmt(n), seen: true } : jreal ? { ...c, count: null } : c; };
  const needle = q.trim().toLowerCase();
  const high = useMemo(() => HIGH_COURTS.filter((c) => !needle || c.name.toLowerCase().includes(needle)).map(withCount), [needle, jc]); // eslint-disable-line react-hooks/exhaustive-deps
  const showSC = !needle || SUPREME_COURT.name.toLowerCase().includes(needle);
  const sel = "h-9 rounded-lg bg-accent px-3 text-[14px] outline-none ring-1 ring-transparent focus:bg-surface focus:ring-primary/50";

  return (
    <div className="mx-auto max-w-[880px] pt-2">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Browse Laws &amp; Judgments</h1>
      {real ? (
        <p className="mt-1 text-[16px] text-[#535151]">{fmt(stats.acts)} {stats.scope ?? "acts"}{jreal && jc?.stats.totalCases ? `, and ${fmt(jc.stats.totalCases)} judgment case records across the Supreme Court and ${jc.courts.length - 1} High Courts` : ""}. {jreal ? ((jc?.stats.listableCourts ?? 1) > 1 ? "Case lists are available for the Supreme Court and every High Court, by year." : "Supreme Court cases can be browsed by year; High Courts show counts only.") : "Judgments are not live yet: the court pages below are a preview."}</p>
      ) : (
        <p className="mt-1 text-[16px] text-[#535151]">{BROWSE_STATS.acts} Indian acts, and {BROWSE_STATS.judgments} judgments across the Supreme Court and {BROWSE_STATS.highCourts} High Courts, plus {BROWSE_STATS.tribunals} Tribunals. (Display figures, mock.)</p>
      )}

      <section aria-labelledby="covers" className="mt-5 rounded-xl bg-surface p-5 shadow-sm ring-1 ring-border/60">
        <h2 id="covers" className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#535151]">{real ? "What is live here" : "What the Data API covers"}</h2>
        {real && stats ? (
          <ul className="mt-3 space-y-3 text-[15px] leading-relaxed">
            <li className="flex gap-3"><span aria-hidden className="mt-1 grid size-4 shrink-0 place-items-center rounded-full border border-success text-[10px] text-success">✓</span><span><strong className="font-medium">Acts &amp; legislation are live.</strong> <span className="text-[#535151]">{fmt(stats.acts)} {stats.scope ?? "acts"}, with {fmt(stats.sections)} section numbers counted. Act-level information only: the text of sections is not shown yet.</span></span></li>
            <li className="flex gap-3"><span aria-hidden className="mt-1 grid size-4 shrink-0 place-items-center rounded-full border border-warning text-[10px] text-warning">⊘</span><span><strong className="font-medium">{jreal ? "Judgment metadata is live in part." : "Judgments and tribunals are not live yet."}</strong> <span className="text-[#535151]">{jreal ? ((jc?.stats.listableCourts ?? 1) > 1 ? "Case lists by year with case-level detail for the Supreme Court and every High Court. Judgment text and tribunals are not live yet." : "Case counts by year for every court, and case lists for the Supreme Court. High Court case lists are not available yet. Judgment text and tribunals are not live yet.") : "The Judgments tab is a preview. Court counts there are reference figures, not data held here."}</span></span></li>
          </ul>
        ) : (
          <ul className="mt-3 space-y-3 text-[15px] leading-relaxed">
            <li className="flex gap-3"><span aria-hidden className="mt-1 grid size-4 shrink-0 place-items-center rounded-full border border-success text-[10px] text-success">✓</span><span><strong className="font-medium">Acts &amp; legislation are live.</strong> <span className="text-[#535151]">The acts endpoints are maintained and serve {BROWSE_STATS.acts} acts across {BROWSE_STATS.sections} sections, mirroring the Government of India&apos;s official repository.</span></span></li>
            <li className="flex gap-3"><span aria-hidden className="mt-1 grid size-4 shrink-0 place-items-center rounded-full border border-warning text-[10px] text-warning">⊘</span><span><strong className="font-medium">Case law and tribunal decisions are not in the API corpus yet.</strong> <span className="text-[#535151]">You can browse and read them here, and coverage runs to mid-2025 only. If you need them over the API, <Link href="/contact" className="text-primary underline">get in touch</Link>.</span></span></li>
          </ul>
        )}
      </section>

      <div className="mt-5">
        <label htmlFor="browse-q" className="sr-only">{tab === "acts" ? "Search act titles" : "Search Supreme Court cases or filter courts by name"}</label>
        <div className="relative">
          <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#65625f]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input id="browse-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "acts" ? "Search act titles…" : "Search Supreme Court cases by party or citation, or filter courts…"} autoComplete="off"
            className="h-12 w-full rounded-xl bg-accent pl-11 pr-4 text-[15px] outline-none ring-1 ring-transparent placeholder:text-[#65625f] focus:bg-surface focus:ring-primary/50" />
        </div>
        <p className="mt-2 px-1 text-[13px] text-[#535151]">{tab === "acts" ? "This box searches act titles (at least 2 characters)." : "This box filters the court list by name and, for two or more characters, searches Supreme Court cases of every year by party name or citation. High Court cases are not searchable by name yet: open a court and year to browse and filter them."} Boolean operators and citation search are not available yet.</p>
      </div>

      <div role="tablist" aria-label="Browse" className="mt-6 flex gap-1 border-b border-border/80">
        {([["judgments", "Judgments", "M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM9 4v16"], ["acts", "Acts & Legislation", "M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z"]] as const).map(([id, label, icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`relative -mb-px inline-flex items-center gap-2 px-4 py-2.5 text-[14px] ${tab === id ? "font-medium text-foreground" : "text-[#535151] hover:text-foreground"}`}>
            <Svg d={icon} />{label}{tab === id && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground" />}
          </button>
        ))}
      </div>

      {tab === "judgments" ? (
        <div role="tabpanel" className="mt-8 space-y-8">
          {q.trim().length >= 2 && jreal && <ScSearchResults q={q.trim()} />}
          {showSC && <section><h2 className="flex items-center gap-2 text-[18px] font-semibold"><span className="text-primary"><Svg d={BANK} size={18} /></span>Supreme Court</h2><div className="mt-3"><CourtCard c={withCount(SUPREME_COURT)} featured real={jreal} countsOnly={countsOnly(SUPREME_COURT)} /></div></section>}
          <section>
            <h2 className="flex items-center gap-2 text-[18px] font-semibold"><span className="text-primary"><Svg d={BANK} size={18} /></span>High Courts</h2>
            {high.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{high.map((c) => <CourtCard key={c.slug} c={c} real={jreal} countsOnly={countsOnly(c)} />)}</div> : <p className="mt-3 text-[14px] text-muted">No court matches &ldquo;{q}&rdquo;.</p>}
          </section>
          {!showSC && !high.length && <p className="text-[14px] text-muted" role="status">No courts match.</p>}
          <p className="text-[13px] text-muted">{ALL_COURTS.length} courts listed. {jreal ? ((jc?.stats.listableCourts ?? 1) > 1 ? "Counts are distinct case records in the open-india-law dataset." : "Counts are distinct case records in the open-india-law dataset; High Courts show counts by year only.") : "Counts are shown only where the reference page showed one."}</p>
        </div>
      ) : (
        <div role="tabpanel" className="mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="f-cat">Category</label>
            <select id="f-cat" className={sel} value={category} onChange={(e) => { const v = e.target.value; setCategory(v); if (v && v !== "state") setState(""); if (v && v !== "regulatory") setDept(""); }}><option value="">All categories</option>{categories.map((x) => <option key={x} value={x}>{label(x)}</option>)}</select>
            {stats?.states?.length && (category === "" || category === "state") ? <><label className="sr-only" htmlFor="f-state">State or UT</label><select id="f-state" className={sel} value={state} onChange={(e) => setState(e.target.value)}><option value="">All states and UTs</option>{stats.states.map((x) => <option key={x} value={x}>{label(x)}</option>)}</select></> : null}
            {stats?.departments?.length && (category === "" || category === "regulatory") ? <><label className="sr-only" htmlFor="f-dept">Regulator</label><select id="f-dept" className={sel} value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All regulators</option>{stats.departments.map((x) => <option key={x} value={x}>{label(x)}</option>)}</select></> : null}
            <label className="sr-only" htmlFor="f-status">Status</label>
            <select id="f-status" className={sel} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option>{statuses.map((x) => <option key={x} value={x}>{label(x)}</option>)}</select>
            <label className="sr-only" htmlFor="f-sort">Sort</label>
            <select id="f-sort" className={sel} value={sort} onChange={(e) => setSort(e.target.value)}><option value="year_desc">Newest first</option><option value="year_asc">Oldest first</option><option value="title_asc">Title A to Z</option><option value="title_desc">Title Z to A</option></select>
            <span className="ml-auto text-[13px] text-muted" role="status">{data ? `${fmt(data.total)} acts${data.source === "mock" ? " (mock rows)" : ""}` : ""}</span>
          </div>
          {err && <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error/40 bg-error/5 p-3 text-[14px]"><span>{err}</span><button type="button" onClick={() => setRetry((n) => n + 1)} className="h-8 rounded-lg px-3 ring-1 ring-border hover:bg-accent">Try again</button></div>}
          {!data && !err && <div className="mt-4 space-y-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="console-skel h-16 rounded-xl bg-accent" />)}</div>}
          {data && (
            <>
              <ul className="mt-4 space-y-2">
                {data.results.map((r) => (
                  <li key={r.actId} className="rounded-xl bg-surface px-5 py-4 shadow-sm ring-1 ring-border/60">
                    <p className="text-[15px] font-medium">{r.title}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[#535151]">
                      <span className="rounded-md bg-accent px-2 py-0.5">{label(r.category)}</span>
                      {r.state && <span className="rounded-md bg-accent px-2 py-0.5">{label(r.state)}</span>}
                      {r.department && <span className="rounded-md bg-accent px-2 py-0.5">{label(r.department)}</span>}
                      <span className="rounded-md bg-accent px-2 py-0.5">{label(r.actStatus)}</span>
                      {r.year !== null && <><span>{r.year}</span><span aria-hidden>·</span></>}<span>{data.source === "mock" ? `${r.sectionCount} sections (placeholder)` : r.sectionCount > 0 ? `${fmt(r.sectionCount)} sections` : "section count unavailable"}</span><span aria-hidden>·</span><span className="font-mono">{r.actId}</span>
                    </p>
                  </li>
                ))}
                {!data.results.length && <li className="rounded-xl border border-dashed border-border p-6 text-center text-[14px] text-muted">No acts match these filters.</li>}
              </ul>
              <div className="mt-4 flex items-center justify-between text-[14px]">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-9 rounded-lg px-3 ring-1 ring-border hover:bg-accent disabled:opacity-40">← Previous</button>
                <span className="text-muted">Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
                <button type="button" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)} className="h-9 rounded-lg px-3 ring-1 ring-border hover:bg-accent disabled:opacity-40">Next →</button>
              </div>
              <p className="mt-3 text-[12px] text-muted">{data.note}</p>
              {real && stats?.attribution && (
                <div className="mt-2 space-y-1 text-[12px] text-muted">
                  <p>{stats.attribution.text} Licence: {stats.attribution.licence}, snapshot {stats.attribution.snapshot}. <a href={stats.attribution.url} className="underline" rel="noopener noreferrer" target="_blank">Dataset</a></p>
                  {stats.caveats.map((c) => <p key={c}>{c}</p>)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
