"use client";
import { useEffect, useState } from "react";
import { Notice, Tabs, Toggle, buttonClass } from "@/components/kit";
import CaseSearchResults from "@/components/workspace/CaseSearchResults";
import SearchField from "@/components/workspace/SearchField";
import SectionSearchResults, { type SectionFilters } from "@/components/workspace/SectionSearchResults";
import DocsSearchResults from "./DocsSearchResults";

// /search: one search box, four places to look (tabs): Laws, Judgments, Regulators, Your documents. Only the open tab is searched, so a search costs one request, not four; counts appear on the tabs already opened.
// By meaning / Exact words applies to Laws, Regulators and Your documents; the Laws tab can also be narrowed (Central or State, in force or repealed). Presentation and state only: the searching is in the API routes and src/lib/legal-data.
export type SearchTab = "laws" | "judgments" | "regulators" | "documents";
const TABS: [SearchTab, string][] = [["laws", "Laws"], ["judgments", "Judgments"], ["regulators", "Regulators"], ["documents", "Your documents"]];
const EXAMPLES = ["notice after cheque bounces", "138 NI Act", "Article 21", "anticipatory bail"];

export default function SearchPage({ initialQ, tab }: { initialQ: string; tab: SearchTab }) {
  const [text, setText] = useState(initialQ), [q, setQ] = useState(initialQ.trim()), [exact, setExact] = useState(false), [filters, setFilters] = useState<SectionFilters>({}), [open, setOpen] = useState(false), [counts, setCounts] = useState<Partial<Record<SearchTab, number | null>>>({});
  useEffect(() => { const t = setTimeout(() => setQ(text.trim().length >= 2 ? text.trim() : ""), 350); return () => clearTimeout(t); }, [text]);   // search as you type, after a short pause
  useEffect(() => { window.history.replaceState(null, "", `/search${q || tab !== "laws" ? `?${new URLSearchParams({ ...(q ? { q } : {}), ...(tab !== "laws" ? { tab } : {}) })}` : ""}`); }, [q, tab]);
  useEffect(() => { setCounts({}); }, [q, exact, filters.jurisdiction, filters.status]);
  const count = (t: SearchTab) => (n: number | null) => setCounts((c) => (c[t] === n ? c : { ...c, [t]: n }));
  const items = TABS.map(([id, label]) => ({ id, label, href: `/search?${new URLSearchParams({ ...(text.trim() ? { q: text.trim() } : {}), ...(id !== "laws" ? { tab: id } : {}) })}`, ...(typeof counts[id] === "number" ? { count: counts[id] as number } : {}) }));
  const narrowed = !!(filters.jurisdiction || filters.status), showFilters = tab === "laws";
  const filterPanel = (
    <div className="space-y-4">
      <div><h3 className="text-ui-sm font-semibold uppercase tracking-caps text-muted">Jurisdiction</h3>
        <Toggle label="Jurisdiction" className="mt-2" value={filters.jurisdiction ?? "any"} onChange={(v) => setFilters((f) => ({ ...f, jurisdiction: v === "any" ? undefined : v }))} options={[["any", "Any"], ["central", "Central"], ["state", "State"]] as const} /></div>
      <div><h3 className="text-ui-sm font-semibold uppercase tracking-caps text-muted">Status</h3>
        <Toggle label="Status" className="mt-2" value={filters.status ?? "any"} onChange={(v) => setFilters((f) => ({ ...f, status: v === "any" ? undefined : v }))} options={[["any", "Any"], ["in_force", "In force"], ["repealed", "Repealed"]] as const} /></div>
      {narrowed && <button type="button" onClick={() => setFilters({})} className={buttonClass("quiet", "sm")}>Clear filters</button>}
    </div>
  );
  return (
    <div className="mx-auto max-w-w1152 pt-2">
      <h1 className="font-serif text-ui-title font-semibold">Search</h1>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SearchField id="search-q" value={text} onChange={setText} className="min-w-0 flex-[1_1_18rem]" label="Search laws, judgments, regulators and your documents" placeholder="Ask a question, describe a situation, or type 138 NI Act" shortPlaceholder="Search the law" />
        {tab !== "judgments" && <Toggle label="Search mode" value={exact ? "exact" : "meaning"} onChange={(v) => setExact(v === "exact")} options={[["meaning", "By meaning"], ["exact", "Exact words"]] as const} />}
        {showFilters && <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={buttonClass("secondary", "md", "lg:hidden")}>Filters{narrowed ? " (on)" : ""}</button>}
      </div>
      <Tabs items={items} current={tab} label="Where to search" className="mt-4" />
      <div className={showFilters ? "mt-5 grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]" : "mt-5"}>
        {showFilters && <aside aria-label="Filters" className={`${open ? "block" : "hidden"} lg:block`}>{filterPanel}</aside>}
        <div className="min-w-0">
          {!q && <Notice tone="info" role="note"><p>Type at least two letters. Try:{" "}{EXAMPLES.map((x, i) => <span key={x}>{i ? " · " : ""}<button type="button" onClick={() => setText(x)} className="font-medium text-primary underline">{x}</button></span>)}</p></Notice>}
          {q && tab === "laws" && <SectionSearchResults q={q} scope="acts" exact={exact} onExactChange={setExact} filters={filters} onCount={count("laws")} heading={false} />}
          {q && tab === "regulators" && <SectionSearchResults q={q} scope="regulators" exact={exact} onExactChange={setExact} onCount={count("regulators")} heading={false} />}
          {q && tab === "judgments" && <CaseSearchResults q={q} />}
          {q && tab === "documents" && <DocsSearchResults q={q} exact={exact} onCount={count("documents")} />}
          <p className="mt-6 text-ui-sm text-muted">Only the open tab is searched. By meaning can miss exact numbers: use Exact words for &ldquo;138 NI Act&rdquo;. Data: open-india-law by Vaquill AI (CC BY 4.0). Not legal advice.</p>
        </div>
      </div>
    </div>
  );
}
