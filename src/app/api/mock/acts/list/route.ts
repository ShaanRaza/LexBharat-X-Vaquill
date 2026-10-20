// MOCK ENDPOINT: stand-in for the documented India acts listing (GET /in/acts/list). Same params and response SHAPE as the public API docs; rows are the invented
// placeholders in src/data/workspaceBrowse.ts. Kept so the mock stays reachable (and testable) even when the real store is active. Nothing real is behind it.
import { mockActsStore, parseActsQuery } from "@/lib/acts";

export async function GET(req: Request) {
  const parsed = parseActsQuery(new URL(req.url).searchParams);
  if ("error" in parsed) return Response.json({ _mock: true, error: parsed.error }, { status: 422 });
  const { query } = parsed, { results, total } = await mockActsStore.list(query), start = (query.page - 1) * query.pageSize;
  return Response.json({
    _mock: true, source: "mock", results, total, page: query.page, pageSize: query.pageSize, hasMore: start + query.pageSize < total,
    meta: { processingTimeMs: 1, creditsConsumed: 0 },
    note: "MOCK listing of invented placeholder rows. Shape follows the public docs for the India acts list; no real corpus is behind it.",
  });
}
