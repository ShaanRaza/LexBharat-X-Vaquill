// GET /api/acts/list: the acts browser's data call. Same params and response shape as the mock (and as the public docs' /in/acts/list), plus `source`
// ("real" | "mock") so the UI can label what it shows. Data comes from the active ActsStore (src/lib/acts).
import { getActsStore, parseActsQuery } from "@/lib/legal-data";

export async function GET(req: Request) {
  const parsed = parseActsQuery(new URL(req.url).searchParams);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 422 });
  const { query } = parsed, store = getActsStore(), t0 = Date.now();
  const { results, total } = await store.list(query);
  const start = (query.page - 1) * query.pageSize;
  return Response.json({
    source: store.source, ...(store.source === "mock" ? { _mock: true } : {}),
    results, total, page: query.page, pageSize: query.pageSize, hasMore: start + query.pageSize < total,
    meta: { processingTimeMs: Date.now() - t0, creditsConsumed: 0 },
    note: store.source === "real" ? "Act-level legislation metadata from the open-india-law dataset (CC BY 4.0). No section text." : "MOCK listing of invented placeholder rows.",
  }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
