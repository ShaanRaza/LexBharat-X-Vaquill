// GET /api/judgments/list?court=<slug>&year=<yyyy>&page&pageSize&search: case METADATA for one court and year. Only the Supreme Court is listable in this phase;
// other courts answer { available: false }. No judgment text is served.
import { getJudgmentsStore } from "@/lib/judgments";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, get = (k: string) => q.get(k)?.trim() || null;
  const court = get("court"), year = Number(get("year")), page = Number(get("page") ?? 1), pageSize = Number(get("pageSize") ?? 25), search = get("search");
  const bad = (error: string) => Response.json({ error }, { status: 422 });
  if (!court) return bad("court is required.");
  if (!Number.isInteger(year) || year < 1900 || year > 2026) return bad("year must be an integer from 1900 to 2026.");
  if (![page, pageSize].every(Number.isInteger) || page < 1 || pageSize < 1 || pageSize > 100) return bad("page must be >= 1 and pageSize 1 to 100.");
  if (search && (search.length < 2 || search.length > 200)) return bad("search must be 2 to 200 characters.");
  const store = getJudgmentsStore();
  if (!(await store.courts()).some((c) => c.slug === court)) return Response.json({ error: "Unknown court." }, { status: 404 });
  const { available, results, total } = await store.list(court, { year, page, pageSize, search });
  return Response.json({ source: store.source, available, court, year, results, total, page, pageSize, hasMore: (page - 1) * pageSize + pageSize < total,
    note: available ? "Case metadata from the open-india-law dataset (CC BY 4.0). No judgment text." : "Case lists are not available for this court yet." },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
