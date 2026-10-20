// MOCK ENDPOINT: stand-in for the documented India acts listing (GET /in/acts/list). The query parameters and the response SHAPE follow the public API
// docs (category, state, department, yearFrom, yearTo, status, search, sort, page, pageSize 1-100 -> { results[], total, page, pageSize, hasMore, meta, note }).
// The rows are the invented placeholders in src/data/workspaceBrowse.ts. Nothing is read from, or sent to, any real service.
import { ACT_CATEGORIES, ACT_STATUSES, MOCK_ACTS } from "@/data/workspaceBrowse";

const SORTS = ["year_desc", "year_asc", "title_asc", "title_desc", "popular"] as const;
const bad = (error: string) => Response.json({ _mock: true, error }, { status: 422 });

export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const get = (k: string) => q.get(k)?.trim() || null;
  const category = get("category"), status = get("status"), sort = get("sort") ?? "year_desc", state = get("state"), department = get("department"), search = get("search");
  if (category && !(ACT_CATEGORIES as readonly string[]).includes(category)) return bad(`Invalid category "${category}".`);
  if (status && !(ACT_STATUSES as readonly string[]).includes(status)) return bad(`Invalid status "${status}".`);
  if (!(SORTS as readonly string[]).includes(sort)) return bad(`Invalid sort "${sort}".`);
  if (search && (search.length < 2 || search.length > 200)) return bad("search must be 2 to 200 characters.");
  const num = (k: string, d: number) => { const v = get(k); return v === null ? d : Number(v); };
  const page = num("page", 1), pageSize = num("pageSize", 50), yearFrom = get("yearFrom") === null ? null : num("yearFrom", 0), yearTo = get("yearTo") === null ? null : num("yearTo", 0);
  if (![page, pageSize].every(Number.isInteger) || page < 1 || pageSize < 1 || pageSize > 100) return bad("page must be >= 1 and pageSize 1 to 100.");
  let rows = MOCK_ACTS.filter((r) =>
    (!category || r.category === category) && (!status || r.actStatus === status) && (!state || r.state === state) && (!department || r.department === department) &&
    (yearFrom === null || r.year >= yearFrom) && (yearTo === null || r.year <= yearTo) && (!search || r.title.toLowerCase().includes(search.toLowerCase())));
  const cmp: Record<string, (x: (typeof rows)[number], y: (typeof rows)[number]) => number> = {
    year_desc: (x, y) => y.year - x.year, popular: (x, y) => y.year - x.year, year_asc: (x, y) => x.year - y.year, title_asc: (x, y) => x.title.localeCompare(y.title), title_desc: (x, y) => y.title.localeCompare(x.title),
  };
  rows = [...rows].sort(cmp[sort]);
  const start = (page - 1) * pageSize;
  return Response.json({
    _mock: true,
    results: rows.slice(start, start + pageSize).map(({ ...r }) => r),
    total: rows.length, page, pageSize, hasMore: start + pageSize < rows.length,
    meta: { processingTimeMs: 1, creditsConsumed: 0 },
    note: "MOCK listing of invented placeholder rows. Shape follows the public docs for the India acts list; no real corpus is behind it.",
  });
}
