// GET /api/judgments/search?q=<words>&page=&pageSize=: Supreme Court cases across ALL years by words in the title (both parties) or the citation.
// Static index, no search service: not full-text search of judgments, and High Courts are not covered (see docs/JUDGMENTS-HC.md).
import { getJudgmentsStore } from "@/lib/judgments";
import { searchSupremeCourt } from "@/lib/judgments/scSearch";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, get = (k: string) => q.get(k)?.trim() || null;
  const court = get("court");
  if (court && court !== "supreme-court-of-india") return Response.json({ error: "court must be supreme-court-of-india for this endpoint (High Courts: /api/judgments/search-hc)." }, { status: 422 });
  const text = get("q") ?? "", page = Number(get("page") ?? 1), pageSize = Number(get("pageSize") ?? 10);
  const bad = (error: string) => Response.json({ error }, { status: 422 });
  if (text.length < 2 || text.length > 200) return bad("q must be 2 to 200 characters.");
  if (![page, pageSize].every(Number.isInteger) || page < 1 || pageSize < 1 || pageSize > 50) return bad("page must be >= 1 and pageSize 1 to 50.");
  const store = getJudgmentsStore();
  if (store.source === "mock") return Response.json({ source: "mock", scope: "supreme-court-of-india", results: [], total: 0, page, pageSize, hasMore: false, note: "Search is not available in mock mode." });
  const { results, total } = searchSupremeCourt(text, page, pageSize);
  return Response.json({ source: store.source, scope: "supreme-court-of-india", results, total, page, pageSize, hasMore: page * pageSize < total,
    note: "Matches words in the Supreme Court case title (both parties) and citation, across all years. Not a full-text search of judgments; High Courts are not included." },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
