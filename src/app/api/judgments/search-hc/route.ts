// GET /api/judgments/search-hc?q=<words or case number>&court=<slug>&year=<yyyy>&page=&pageSize=
// High Court cases across ALL years (and courts) by PARTY NAMES and CASE NUMBERS as recorded in the dataset, from a compact static index. Not full-text search of judgments.
// Newest first; a query that is a case number ("933/2024", "933 of 2024") returns exactly the cases with that number. Without the index: 200 with indexAvailable:false.
import { ALL_COURTS } from "@/data/workspaceBrowse";
import { getJudgmentsStore, searchHighCourts } from "@/lib/legal-data";
import { SC_SLUG } from "@/lib/judgments/provenance";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, get = (k: string) => q.get(k)?.trim() || null;
  const text = get("q") ?? "", court = get("court"), year = get("year") === null ? undefined : Number(get("year")), page = Number(get("page") ?? 1), pageSize = Number(get("pageSize") ?? 20);
  const bad = (error: string) => Response.json({ error }, { status: 422 });
  if (text.length < 2 || text.length > 200) return bad("q must be 2 to 200 characters.");
  if (court && (court === SC_SLUG || !ALL_COURTS.some((c) => c.slug === court))) return bad("court must be a High Court slug.");
  if (year !== undefined && (!Number.isInteger(year) || year < 1900 || year > 2026)) return bad("year must be an integer from 1900 to 2026.");
  if (![page, pageSize].every(Number.isInteger) || page < 1 || pageSize < 1 || pageSize > 50) return bad("page must be >= 1 and pageSize 1 to 50.");
  const scope = "party names and case numbers as recorded in the dataset (not judgment text)";
  const store = getJudgmentsStore();
  const r = store.source === "mock" ? { indexAvailable: false, total: 0, results: [], note: "Search is not available in mock mode." } : await searchHighCourts({ q: text, court: court ?? undefined, year, page, pageSize });
  return Response.json({ source: store.source, scope: "high-courts", searched: scope, ...r, page, pageSize, hasMore: page * pageSize < r.total,
    note: r.note ?? `Matches ${scope}, across all years${court ? " in this court" : " and all High Courts"}, newest first.` },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
