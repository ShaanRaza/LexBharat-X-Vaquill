"use client";
import { sourceInfo, unitWord } from "@/lib/docs/docType.mjs";
import Link from "next/link";
import { noticeFor, type SemanticInfo } from "@/lib/acts/meaning.mjs";
import { useEffect, useState } from "react";
import { Badge, Highlight, Notice, Panel, RepealedNote, Toggle } from "@/components/kit";
import { departmentLabel } from "@/lib/acts/departments.mjs";
import { STATUS_INFO, INCOMPLETE_NOTICE, officialSourceUrl } from "@/lib/acts/quality";
import { gapSentence } from "@/lib/chat/gaps.mjs";
import { cleanLabel } from "@/lib/text/clean.mjs";

// Results of the Acts-tab search box over Central and State Acts (GET /api/acts/search): by meaning by default, exact words on request. Presentation and fetching only; the search itself lives in
// src/lib/acts/searchStore.ts. Colours, sizes and radii come from the tokens through Tailwind names and the shared kit.
type Hit = { flags: string[]; actId: string; actTitle: string; year: number | null; category: string; state: string | null; sourceUrl: string | null; sectionKey: string; number: string | null; heading: string | null; chapter: string | null; status: keyof typeof STATUS_INFO; snippet: string; via: "text" | "lookup" | "semantic"; department?: string | null; copies?: number };
type Resp = { searchAvailable: boolean; message?: string; results: Hit[]; total: number; totalCapped?: boolean; page: number; pageSize: number; hasMore: boolean; mode?: "text" | "lookup" | "semantic"; note?: string; semantic?: SemanticInfo; missing?: { actTitle: string; number: string; sourceUrl: string | null; beyond?: number | null } };
const label = (v: string) => v.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

export type SectionFilters = { jurisdiction?: "central" | "state"; status?: "in_force" | "repealed" };
// Used on the Search page with the scope, the exact-words choice and the filters held by the page (props), and on its own (the props left out: it shows its own scope toggle).
export default function SectionSearchResults({ q, scope: fixedScope, exact: exactProp, onExactChange, filters, onCount, heading = true }: { q: string; scope?: "acts" | "regulators"; exact?: boolean; onExactChange?: (v: boolean) => void; filters?: SectionFilters; onCount?: (n: number | null) => void; heading?: boolean }) {
  const [scopeS, setScope] = useState<"acts" | "regulators">("acts"), [exactS, setExactS] = useState(false), [page, setPage] = useState(1), [data, setData] = useState<Resp | null>(null), [err, setErr] = useState(""), [retry, setRetry] = useState(0);
  const scope = fixedScope ?? scopeS, exact = exactProp ?? exactS, setExact = (v: boolean) => (onExactChange ? onExactChange(v) : setExactS(v)), fkey = `${filters?.jurisdiction ?? ""}|${filters?.status ?? ""}`;
  useEffect(() => { setPage(1); if (exactProp === undefined) setExactS(false); }, [q, scope, fkey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ac = new AbortController(), t = setTimeout(() => {
      setErr("");
      fetch(`/api/acts/search?q=${encodeURIComponent(q)}&page=${page}${exact ? "&exact=1" : ""}${scope === "regulators" ? "&scope=regulators" : ""}${filters?.jurisdiction ? `&jurisdiction=${filters.jurisdiction}` : ""}${filters?.status ? `&status=${filters.status}` : ""}`, { signal: ac.signal }).then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : `Search failed (status ${r.status}).`);
        setData(j as Resp); onCount?.((j as Resp).searchAvailable ? (j as Resp).total : null);
      }).catch((e) => { if ((e as Error).name !== "AbortError") { setErr((e as Error).message || "Search failed."); setData(null); } });
    }, 250);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q, page, retry, exact, scope, fkey]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <section aria-labelledby="sec-hits" className="mt-6">
      {heading && <h2 id="sec-hits" className="text-ui-lead font-semibold">Sections matching &ldquo;{q}&rdquo;{data?.searchAvailable && data.total > 0 ? <span className="ml-2 text-ui-base font-normal text-muted">{data.total.toLocaleString("en-IN")}{data.totalCapped ? "+" : ""} {data.total === 1 ? "section" : "sections"}</span> : null}</h2>}
      {!fixedScope && <Toggle label="What to search" className="mt-2" value={scope} onChange={(k) => { setData(null); setScope(k); }} options={[["acts", "Acts (Central and State)"], ["regulators", "Regulators, Law Commission"]] as const} />}
      {err && <Notice tone="bad" role="alert" className="mt-3"><p>{err}</p><button type="button" onClick={() => setRetry((n) => n + 1)} className="rounded-button px-3 py-1 text-ui-base ring-1 ring-control-border hover:bg-accent">Try again</button></Notice>}
      {!data && !err && <div className="mt-3 space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="console-skel h-20 rounded-card bg-accent" />)}</div>}
      {data && !data.searchAvailable && <Notice tone="info" role="status" className="mt-3"><p><strong className="font-medium text-foreground">Section search is not available yet.</strong> {data.message ?? ""} Searching act titles below still works.</p></Notice>}
      {data?.searchAvailable && (
        <>
          {noticeFor(data.semantic) && <Notice tone="warn" role="status" compact className="mt-2"><p>{noticeFor(data.semantic)}</p></Notice>}
          {data.note && !data.missing && <p className="mt-1 text-ui-sm text-muted">{data.note}</p>}   {/* a missing section is said once, in the notice below */}
          {data.mode === "semantic" && <button type="button" onClick={() => { setExact(true); setPage(1); }} className="mt-1 text-ui-sm font-medium text-primary underline">Search exact words instead</button>}
          {exact && data.mode === "text" && <button type="button" onClick={() => { setExact(false); setPage(1); }} className="mt-1 text-ui-sm font-medium text-primary underline">Search by meaning instead</button>}
          {data.missing && (   // one sentence and one link, the same words as in Ask (src/lib/chat/gaps.mjs): short Act name, the full title on hover
            <Notice tone="warn" role="status" className="mt-3">
              <p>{gapSentence({ kind: data.missing.beyond ? "nosuch" : "missing", number: data.missing.number, actTitle: data.missing.actTitle, max: data.missing.beyond ?? undefined })} <a className="font-medium underline" title={data.missing.actTitle} href={officialSourceUrl(data.missing.sourceUrl, data.missing.actTitle)} target="_blank" rel="noopener noreferrer">Read it on India Code (search for this Act)</a></p>
            </Notice>
          )}
          <ul className="mt-3 space-y-2">
            {data.results.map((h) => (
              <Panel as="li" key={`${h.actId}-${h.sectionKey}`} className="px-card py-4">
                <Link href={`/law/${h.actId}/${encodeURIComponent(h.sectionKey)}`} className="text-ui-body font-medium text-primary hover:underline">
                  {h.number ? unitWord(h.number, { title: h.actTitle, category: h.category, department: h.department, actId: h.actId }) : "Text block"}{h.heading ? ` — ${cleanLabel(h.heading)}` : ""}
                </Link>
                <p className="mt-0.5 text-ui-sm text-secondary">{h.actTitle}{h.chapter ? ` · ${cleanLabel(h.chapter)}` : ""} <RepealedNote actId={h.actId} /></p>
                {h.snippet && <p className="mt-2 text-ui-base leading-relaxed text-foreground"><Highlight snippet={h.snippet} /></p>}
                {h.status === "possibly_incomplete" && (
                  <Notice tone="warn" role="note" compact className="mt-2"><p><strong className="font-medium text-foreground">Possibly incomplete.</strong> {INCOMPLETE_NOTICE.replace("Check India Code", "Check the original")} {(() => { const src = sourceInfo({ title: h.actTitle, category: h.category, department: h.department, actId: h.actId }, h.sourceUrl); return src ? <a className="font-medium underline" href={src.url} target="_blank" rel="noopener noreferrer">Open on {src.label}</a> : null; })()}</p></Notice>
                )}
                <p className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge>{h.department ? (departmentLabel(h.department) ?? label(h.department)) : label(h.category)}</Badge>{h.state && <Badge>{label(h.state)}</Badge>}{h.year !== null && <Badge>{h.year}</Badge>}
                  {h.via === "lookup" && <Badge tone="info">Section lookup</Badge>}
                  {h.via === "semantic" && <Badge tone="info" title="Found by meaning, not by matching your exact words">By meaning</Badge>}
                  {(h.copies ?? 0) > 0 && <Badge title="The same Act text is filed this many more times in the dataset (for example under other states); only one is shown">{h.copies} other {h.copies === 1 ? "copy" : "copies"}</Badge>}
                  {h.flags.includes("supplement")
                    ? <Badge tone="info" title="Copied by hand from India Code to fill a gap in our source data">Filled in from India Code</Badge>
                    : <Badge tone={STATUS_INFO[h.status].tone} title={STATUS_INFO[h.status].explain}>{STATUS_INFO[h.status].label}</Badge>}
                </p>
              </Panel>
            ))}
            {!data.results.length && !data.missing && <li className="rounded-card border border-dashed border-border p-6 text-center text-ui-base text-muted">{data.note ?? "No section matches."}</li>}
          </ul>
          {data.total > data.pageSize && (
            <div className="mt-3 flex items-center justify-between text-ui-base">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-9 rounded-button px-3 ring-1 ring-control-border hover:bg-accent disabled:opacity-40">← Previous</button>
              <span className="text-muted">Page {data.page} of {pages.toLocaleString("en-IN")}{data.totalCapped ? "+" : ""}</span>
              <button type="button" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)} className="h-9 rounded-button px-3 ring-1 ring-control-border hover:bg-accent disabled:opacity-40">Next →</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
