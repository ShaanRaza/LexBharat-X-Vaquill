"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Item } from "@/data/hubs";

const PAGE = 24;

/** Searchable, filterable, paginated list for a content hub. All filtering happens in the browser. */
export default function HubList({ items, base, linked, noun }: { items: Item[]; base: string; linked: boolean; noun: string }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [page, setPage] = useState(0);
  const cats = useMemo(() => ["All", ...new Set(items.map((i) => i.category).filter(Boolean) as string[])], [items]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items.filter((i) => (cat === "All" || i.category === cat) && (!t || i.title.toLowerCase().includes(t)));
  }, [items, q, cat]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const slice = filtered.slice(cur * PAGE, cur * PAGE + PAGE);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="hub-q" className="sr-only">Search {noun}</label>
        <input id="hub-q" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={`Search ${items.length} ${noun}…`} className="min-w-[220px] flex-1 rounded-control border border-[var(--control-border)] bg-surface px-3 py-2 text-[15px]" />
        {cats.length > 2 && (
          <select aria-label="Category" value={cat} onChange={(e) => { setCat(e.target.value); setPage(0); }} className="rounded-control border border-[var(--control-border)] bg-surface px-3 py-2 text-[15px]">
            {cats.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
        <p className="text-[13px] text-muted" aria-live="polite">{filtered.length} of {items.length}</p>
      </div>

      <ul className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {slice.map((i) => {
          const body = (
            <article className="h-full rounded-panel border border-border bg-surface p-5 transition-transform duration-300 ease-out hover:-translate-y-0.5">
              {i.category && <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-primary">{i.category}</p>}
              <h2 className="text-[16px] font-semibold leading-snug">{i.title}</h2>
              {i.summary && <p className="mt-1 text-[13px] leading-relaxed text-muted">{i.summary}</p>}
            </article>
          );
          return <li key={i.slug}>{linked ? <Link href={`${base}/${i.slug}`} className="block h-full">{body}</Link> : body}</li>;
        })}
      </ul>
      {filtered.length === 0 && <p className="mt-6 text-[15px] text-muted">Nothing matches “{q}”.</p>}

      {pages > 1 && (
        <nav className="mt-8 flex items-center justify-between gap-3" aria-label="Pagination">
          <button onClick={() => setPage(Math.max(0, cur - 1))} disabled={cur === 0} className="btn btn-secondary !px-4 !py-2 !text-[14px] disabled:opacity-40">← Previous</button>
          <span className="text-[14px] text-muted">Page {cur + 1} of {pages}</span>
          <button onClick={() => setPage(Math.min(pages - 1, cur + 1))} disabled={cur >= pages - 1} className="btn btn-secondary !px-4 !py-2 !text-[14px] disabled:opacity-40">Next →</button>
        </nav>
      )}
    </div>
  );
}
