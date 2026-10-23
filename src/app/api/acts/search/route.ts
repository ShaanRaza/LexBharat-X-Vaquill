// GET /api/acts/search?q=<words, "exact phrase", or a section lookup like "138 NI Act">&page=
// Keyword search over the TEXT of Central and State Acts (Neon Postgres full-text search). 12 results per page, same paging fields as /api/judgments/search-hc.
// Without DATABASE_URL: 200 with searchAvailable:false (never an error page).
import { normalizeQuery, hasDevanagari } from "@/lib/acts/searchQuery.mjs";
import { searchSections, PAGE_SIZE } from "@/lib/acts/searchStore";

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const bad = (error: string) => Response.json({ error }, { status: 422 });
  const nq = normalizeQuery(p.get("q"));
  if (nq.q === undefined) return bad(nq.error);
  const q = nq.q;
  const page = Number(p.get("page") ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 1000) return bad("page must be a whole number from 1 to 1000.");
  const r = await searchSections(q, page, PAGE_SIZE);
  if (!r.available) return Response.json({ searchAvailable: false, reason: r.reason, message: r.message, results: [], total: 0, page, pageSize: PAGE_SIZE, hasMore: false }, { headers: { "Cache-Control": "no-store" } });
  return Response.json({ searchAvailable: true, scope: "text of Central and State Acts (English)", hindiNotSearchable: hasDevanagari(q), ...r },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
