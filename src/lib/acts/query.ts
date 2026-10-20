// Shared query parsing + in-memory filter/sort/paginate for the acts list. Used by every acts store (mock rows and the Phase 1 JSON store),
// so the HTTP contract (params, validation, ordering) is identical whichever store is active. A future Postgres store would translate the same
// ActsQuery into SQL instead of calling runActsQuery.
import { ACT_CATEGORIES, ACT_STATUSES, type ActItem } from "@/data/workspaceBrowse";

export const ACT_SORTS = ["year_desc", "year_asc", "title_asc", "title_desc", "popular"] as const;
export type ActsQuery = {
  category: string | null; status: string | null; state: string | null; department: string | null; search: string | null;
  yearFrom: number | null; yearTo: number | null; sort: (typeof ACT_SORTS)[number]; page: number; pageSize: number;
};

export function parseActsQuery(q: URLSearchParams): { query: ActsQuery } | { error: string } {
  const get = (k: string) => q.get(k)?.trim() || null;
  const category = get("category"), status = get("status"), sort = get("sort") ?? "year_desc", search = get("search");
  if (category && !(ACT_CATEGORIES as readonly string[]).includes(category)) return { error: `Invalid category "${category}".` };
  if (status && !(ACT_STATUSES as readonly string[]).includes(status)) return { error: `Invalid status "${status}".` };
  if (!(ACT_SORTS as readonly string[]).includes(sort)) return { error: `Invalid sort "${sort}".` };
  if (search && (search.length < 2 || search.length > 200)) return { error: "search must be 2 to 200 characters." };
  const num = (k: string, d: number) => { const v = get(k); return v === null ? d : Number(v); };
  const page = num("page", 1), pageSize = num("pageSize", 50);
  const yearFrom = get("yearFrom") === null ? null : num("yearFrom", 0), yearTo = get("yearTo") === null ? null : num("yearTo", 0);
  if (![page, pageSize].every(Number.isInteger) || page < 1 || pageSize < 1 || pageSize > 100) return { error: "page must be >= 1 and pageSize 1 to 100." };
  if ((yearFrom !== null && !Number.isInteger(yearFrom)) || (yearTo !== null && !Number.isInteger(yearTo))) return { error: "yearFrom and yearTo must be integers." };
  return { query: { category, status, state: get("state"), department: get("department"), search, yearFrom, yearTo, sort: sort as ActsQuery["sort"], page, pageSize } };
}

// Acts with no known year sort last in both directions and never match a yearFrom/yearTo filter.
const byYear = (dir: 1 | -1) => (x: ActItem, y: ActItem) => (x.year === null ? 1 : 0) - (y.year === null ? 1 : 0) || (x.year === null ? 0 : dir * (x.year - (y.year as number)));
const byTitle = (dir: 1 | -1) => (x: ActItem, y: ActItem) => dir * x.title.localeCompare(y.title);
const SORT_FNS: Record<ActsQuery["sort"], (x: ActItem, y: ActItem) => number> = {
  year_desc: byYear(-1), popular: byYear(-1), year_asc: byYear(1), title_asc: byTitle(1), title_desc: byTitle(-1),
};

export function runActsQuery(rows: readonly ActItem[], q: ActsQuery): { results: ActItem[]; total: number } {
  const needle = q.search?.toLowerCase();
  const hit = rows.filter((r) =>
    (!q.category || r.category === q.category) && (!q.status || r.actStatus === q.status) && (!q.state || r.state === q.state) && (!q.department || r.department === q.department) &&
    (q.yearFrom === null || (r.year !== null && r.year >= q.yearFrom)) && (q.yearTo === null || (r.year !== null && r.year <= q.yearTo)) &&
    (!needle || r.title.toLowerCase().includes(needle)));
  hit.sort(SORT_FNS[q.sort]);
  const start = (q.page - 1) * q.pageSize;
  return { results: hit.slice(start, start + q.pageSize), total: hit.length };
}
