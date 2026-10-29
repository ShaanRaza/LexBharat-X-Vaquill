"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Notice, Panel, Toggle, buttonClass, fieldClass, selectClass } from "@/components/kit";
import { departmentLabel } from "@/lib/acts/departments.mjs";
import type { ActItem } from "@/data/workspaceBrowse";

// Library > Acts: the list of Acts with filters (Central or State, category, status) and a box that searches within the list (GET /api/acts/list). Presentation and fetching only.
type Resp = { source?: "real" | "mock"; results: ActItem[]; total: number; page: number; pageSize: number; hasMore: boolean; note?: string };
type Stats = { categories: string[]; statuses: string[]; states?: string[]; departments?: string[]; caveats: string[]; attribution?: { text: string; url: string; licence: string; snapshot: string } };
const PAGE = 10, fmt = (n: number) => n.toLocaleString("en-IN");
const label = (v: string) => departmentLabel(v) ?? (v.includes("_") ? v.replace(/_/g, " ") : v.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "));

export default function ActsList({ initial }: { initial?: { category?: string; department?: string; state?: string } }) {
  const [jur, setJur] = useState<"any" | "central" | "state">(initial?.category === "central" || initial?.category === "state" ? initial.category : initial?.category || initial?.department ? "any" : "central");   // Central Acts to start with: "All" also lists some 20,000 regulator instruments
  const [category, setCategory] = useState(initial?.category === "regulatory" ? "regulatory" : ""), [dept] = useState(initial?.department ?? ""), [state, setState] = useState(initial?.state ?? "");
  const [status, setStatus] = useState("in_force"), [q, setQ] = useState(""), [sort, setSort] = useState("year_desc"), [page, setPage] = useState(1);
  const [data, setData] = useState<Resp | null>(null), [err, setErr] = useState(""), [stats, setStats] = useState<Stats | null>(null), [retry, setRetry] = useState(0);
  useEffect(() => { fetch("/api/acts/stats").then((r) => (r.ok ? r.json() : null)).then((j) => setStats(j as Stats | null)).catch(() => setStats(null)); }, []);
  useEffect(() => { setPage(1); }, [jur, category, state, status, q, sort]);
  useEffect(() => {
    const ac = new AbortController(), t = setTimeout(() => {
      const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE), sort });
      const cat = category || (jur !== "any" ? jur : ""); if (cat) p.set("category", cat);
      if (status) p.set("status", status); if (state) p.set("state", state); if (dept) p.set("department", dept); if (q.trim().length >= 2) p.set("search", q.trim());
      setErr("");
      fetch(`/api/acts/list?${p}`, { signal: ac.signal }).then(async (r) => { const j = await r.json().catch(() => null); if (!r.ok || !j) throw new Error(j?.error ?? `The list could not be loaded (status ${r.status}).`); setData(j as Resp); })
        .catch((e) => { if ((e as Error).name !== "AbortError") { setErr((e as Error).message); setData(null); } });
    }, q ? 250 : 0);
    return () => { clearTimeout(t); ac.abort(); };
  }, [jur, category, state, status, q, sort, page, dept, retry]);
  const statuses = stats?.statuses ?? ["in_force", "repealed"], categories = (stats?.categories ?? []).filter((c) => c !== "central" && c !== "state");
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-end gap-3">
        <Toggle label="Jurisdiction" value={jur} onChange={(v) => { setJur(v); setCategory(""); if (v !== "state") setState(""); }} options={[["any", "All"], ["central", "Central"], ["state", "State"]] as const} />
        {categories.length > 0 && <select aria-label="Category" className={selectClass(!!category)} value={category} onChange={(e) => { setCategory(e.target.value); if (e.target.value) setJur("any"); }}><option value="">Category: any</option>{categories.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select>}
        {jur === "state" && !!stats?.states?.length && <select aria-label="State or UT" className={selectClass(!!state)} value={state} onChange={(e) => setState(e.target.value)}><option value="">All States and UTs</option>{stats.states.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>}
        <select aria-label="Status" className={selectClass(status !== "in_force")} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Status: any</option>{statuses.map((s) => <option key={s} value={s}>Status: {label(s)}</option>)}</select>
        <select aria-label="Sort" className={selectClass(sort !== "year_desc")} value={sort} onChange={(e) => setSort(e.target.value)}><option value="year_desc">Newest first</option><option value="year_asc">Oldest first</option><option value="title_asc">Title A to Z</option></select>
        <input type="search" aria-label="Search within the list" placeholder="Search within the list" value={q} onChange={(e) => setQ(e.target.value.slice(0, 120))} className={`${fieldClass} min-w-0 flex-[1_1_14rem]`} />
      </div>
      {dept && <p className="mt-3 text-ui-sm text-secondary">Showing Acts and instruments of <strong className="font-medium text-foreground">{label(dept)}</strong>. <Link href="/library?tab=acts" className="font-medium text-primary underline">Show all</Link></p>}
      {err && <Notice tone="bad" role="alert" className="mt-4"><p>{err}</p><button type="button" onClick={() => setRetry((n) => n + 1)} className={buttonClass("secondary", "sm")}>Try again</button></Notice>}
      {!data && !err && <div className="mt-4 space-y-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="console-skel h-16 rounded-card bg-accent" />)}</div>}
      {data && (
        <>
          <p className="mt-4 text-ui-sm text-muted" role="status">{fmt(data.total)} {data.total === 1 ? "Act" : "Acts"}{data.source === "mock" ? " (placeholder rows)" : ""}</p>
          <ul className="mt-2 space-y-2">
            {data.results.map((r) => (
              <Panel as="li" key={r.actId} className="px-card py-4">
                <p className="text-ui-body font-medium">{data.source === "real" ? <Link href={`/law/${r.actId}`} className="text-primary hover:underline">{r.title}</Link> : r.title}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-ui-sm text-secondary">
                  <Badge>{label(r.category)}</Badge>{r.state && <Badge>{label(r.state)}</Badge>}{r.department && <Badge>{label(r.department)}</Badge>}
                  <Badge tone={r.actStatus === "in_force" ? "complete" : "neutral"}>{label(r.actStatus)}</Badge>
                  {r.year !== null && <span>{r.year}</span>}<span aria-hidden>·</span><span>{r.sectionCount > 0 ? `${fmt(r.sectionCount)} sections` : "section count unavailable"}</span>
                </p>
              </Panel>
            ))}
            {!data.results.length && <li className="rounded-card border border-dashed border-border p-6 text-center text-ui-base text-muted">No Acts match these filters.</li>}
          </ul>
          <div className="mt-4 flex items-center justify-between text-ui-base">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={buttonClass("secondary", "md")}>← Previous</button>
            <span className="text-muted">Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
            <button type="button" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)} className={buttonClass("secondary", "md")}>Next →</button>
          </div>
          <div className="mt-4 space-y-1 text-ui-sm text-muted">
            {stats?.attribution && <p>{stats.attribution.text} Licence: {stats.attribution.licence}, snapshot {stats.attribution.snapshot}. <a href={stats.attribution.url} className="underline" rel="noopener noreferrer" target="_blank">Dataset</a></p>}
            {stats?.caveats.map((c) => <p key={c}>{c}</p>)}
          </div>
        </>
      )}
    </div>
  );
}
