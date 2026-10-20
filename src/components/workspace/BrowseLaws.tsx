"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ACT_CATEGORIES, ACT_STATUSES, ALL_COURTS, BROWSE_STATS, HIGH_COURTS, SUPREME_COURT, type ActItem, type Court } from "@/data/workspaceBrowse";

// "Browse Laws & Judgments" (layout recreated from a screenshot of the original app). Judgments tab: court cards from display data. Acts tab: a
// client fetch of the local mock /api/mock/acts/list. Everything shown is mock or display data (docs/ACTS-AND-JUDGMENTS.md).

const BANK = "M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18";
const Svg = ({ d, size = 16 }: { d: string; size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

function CourtCard({ c, featured }: { c: Court; featured?: boolean }) {
  return (
    <Link href={`/workspace/browse/judgments/${c.slug}`} className={`group flex items-center gap-4 rounded-xl bg-surface px-5 py-4 shadow-sm ring-1 transition-colors hover:ring-primary/50 ${featured ? "ring-primary/30" : "ring-border/70"}`}>
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent text-muted"><Svg d={BANK} size={22} /></span>
      <span className="min-w-0 flex-1 leading-snug">
        <span className="block text-[15px] font-medium text-primary">{c.name}</span>
        <span className="block text-[13px] text-muted">{c.count ? `${c.count} judgments` : "Count not captured"}</span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
    </Link>
  );
}

type ActsResponse = { results: ActItem[]; total: number; page: number; pageSize: number; hasMore: boolean; note?: string };
const PAGE = 8;

export default function BrowseLaws({ initialTab }: { initialTab: "judgments" | "acts" }) {
  const [tab, setTab] = useState(initialTab);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("year_desc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ActsResponse | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => { setPage(1); }, [q, category, status, sort]);
  useEffect(() => {
    if (tab !== "acts") return;
    const ac = new AbortController();
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE), sort });
    if (category) p.set("category", category);
    if (status) p.set("status", status);
    if (q.trim().length >= 2) p.set("search", q.trim());
    setErr("");
    fetch(`/api/mock/acts/list?${p}`, { signal: ac.signal }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? String(r.status)); setData(j as ActsResponse); })
      .catch((e) => { if ((e as Error).name !== "AbortError") { setErr((e as Error).message || "Could not load acts."); setData(null); } });
    return () => ac.abort();
  }, [tab, q, category, status, sort, page]);

  const needle = q.trim().toLowerCase();
  const high = useMemo(() => HIGH_COURTS.filter((c) => !needle || c.name.toLowerCase().includes(needle)), [needle]);
  const showSC = !needle || SUPREME_COURT.name.toLowerCase().includes(needle);
  const sel = "h-9 rounded-lg bg-accent px-3 text-[14px] outline-none ring-1 ring-transparent focus:bg-surface focus:ring-primary/50";

  return (
    <div className="mx-auto max-w-[880px] pt-2">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Browse Laws &amp; Judgments</h1>
      <p className="mt-1 text-[16px] text-[#535151]">{BROWSE_STATS.acts} Indian acts, and {BROWSE_STATS.judgments} judgments across the Supreme Court and {BROWSE_STATS.highCourts} High Courts, plus {BROWSE_STATS.tribunals} Tribunals.</p>

      <section aria-labelledby="covers" className="mt-5 rounded-xl bg-surface p-5 shadow-sm ring-1 ring-border/60">
        <h2 id="covers" className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#535151]">What the Data API covers</h2>
        <ul className="mt-3 space-y-3 text-[15px] leading-relaxed">
          <li className="flex gap-3"><span aria-hidden className="mt-1 grid size-4 shrink-0 place-items-center rounded-full border border-success text-[10px] text-success">✓</span><span><strong className="font-medium">Acts &amp; legislation are live.</strong> <span className="text-[#535151]">The acts endpoints are maintained and serve {BROWSE_STATS.acts} acts across {BROWSE_STATS.sections} sections, mirroring the Government of India&apos;s official repository.</span></span></li>
          <li className="flex gap-3"><span aria-hidden className="mt-1 grid size-4 shrink-0 place-items-center rounded-full border border-warning text-[10px] text-warning">⊘</span><span><strong className="font-medium">Case law and tribunal decisions are not in the API corpus yet.</strong> <span className="text-[#535151]">You can browse and read them here, and coverage runs to mid-2025 only. If you need them over the API, <Link href="/contact" className="text-primary underline">get in touch</Link>.</span></span></li>
        </ul>
      </section>

      <div className="mt-5">
        <label htmlFor="browse-q" className="sr-only">Search cases, acts, or legislation</label>
        <div className="relative">
          <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#65625f]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input id="browse-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cases, acts, or legislation across all courts…" autoComplete="off"
            className="h-12 w-full rounded-xl bg-accent pl-11 pr-4 text-[15px] outline-none ring-1 ring-transparent placeholder:text-[#65625f] focus:bg-surface focus:ring-primary/50" />
        </div>
        <p className="mt-2 px-1 text-[13px] text-[#535151]">Here this box filters the lists below. <span title="Not part of this clone">Advanced Research</span> (Boolean operators, citation search, section-level matching) is not recreated.</p>
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
          {showSC && <section><h2 className="flex items-center gap-2 text-[18px] font-semibold"><span className="text-primary"><Svg d={BANK} size={18} /></span>Supreme Court</h2><div className="mt-3"><CourtCard c={SUPREME_COURT} featured /></div></section>}
          <section>
            <h2 className="flex items-center gap-2 text-[18px] font-semibold"><span className="text-primary"><Svg d={BANK} size={18} /></span>High Courts</h2>
            {high.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{high.map((c) => <CourtCard key={c.slug} c={c} />)}</div> : <p className="mt-3 text-[14px] text-muted">No court matches &ldquo;{q}&rdquo;.</p>}
          </section>
          {!showSC && !high.length && <p className="text-[14px] text-muted" role="status">No courts match.</p>}
          <p className="text-[13px] text-muted">{ALL_COURTS.length} courts listed. Counts are shown only where the reference page showed one.</p>
        </div>
      ) : (
        <div role="tabpanel" className="mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="f-cat">Category</label>
            <select id="f-cat" className={sel} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{ACT_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select>
            <label className="sr-only" htmlFor="f-status">Status</label>
            <select id="f-status" className={sel} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option>{ACT_STATUSES.map((x) => <option key={x}>{x}</option>)}</select>
            <label className="sr-only" htmlFor="f-sort">Sort</label>
            <select id="f-sort" className={sel} value={sort} onChange={(e) => setSort(e.target.value)}><option value="year_desc">Newest first</option><option value="year_asc">Oldest first</option><option value="title_asc">Title A to Z</option><option value="title_desc">Title Z to A</option></select>
            <span className="ml-auto text-[13px] text-muted" role="status">{data ? `${data.total} acts (mock rows)` : ""}</span>
          </div>
          {err && <p role="alert" className="mt-4 rounded-lg border border-error/40 bg-error/5 p-3 text-[14px]">{err}</p>}
          {!data && !err && <div className="mt-4 space-y-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="console-skel h-16 rounded-xl bg-accent" />)}</div>}
          {data && (
            <>
              <ul className="mt-4 space-y-2">
                {data.results.map((r) => (
                  <li key={r.actId} className="rounded-xl bg-surface px-5 py-4 shadow-sm ring-1 ring-border/60">
                    <p className="text-[15px] font-medium">{r.title}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[#535151]">
                      <span className="rounded-md bg-accent px-2 py-0.5">{r.category}</span>
                      {r.state && <span className="rounded-md bg-accent px-2 py-0.5">{r.state}</span>}
                      {r.department && <span className="rounded-md bg-accent px-2 py-0.5">{r.department}</span>}
                      <span className="rounded-md bg-accent px-2 py-0.5">{r.actStatus}</span>
                      <span>{r.year}</span><span aria-hidden>·</span><span>{r.sectionCount} sections (placeholder)</span><span aria-hidden>·</span><span className="font-mono">{r.actId}</span>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
