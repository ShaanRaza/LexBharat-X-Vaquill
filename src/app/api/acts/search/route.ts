// GET /api/acts/search?q=<a question, words, "exact phrase", or a section lookup like "138 NI Act">&page=&exact=1
// Default: search BY MEANING over Central and State Acts (voyage-4 query embedding + one vector store per corpus, src/lib/acts/vectorStore.ts). Section lookups ("138 NI Act"), "quoted phrases" and exact=1 use keyword search over the
// text of Central and State Acts (Neon Postgres full-text search). When search by meaning is not set up (VOYAGE_API_KEY and a vector store) or fails, keyword search answers with a note.
// 12 results per page, same paging fields as /api/judgments/search-hc. Without DATABASE_URL: 200 with searchAvailable:false (never an error page).
// Limit: 30 searches per minute per caller address, counted in Supabase so it holds across server instances (src/lib/limits/counters.ts), so the embedding key cannot be run up through this endpoint.
import { normalizeQuery, hasDevanagari } from "@/lib/acts/searchQuery.mjs";
import { clientKey } from "@/lib/acts/semantic.mjs";
import { rateCheck } from "@/lib/limits/counters";
import { searchSections, PAGE_SIZE } from "@/lib/acts/searchStore";

const SEARCHES_PER_MINUTE = 30;

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const bad = (error: string) => Response.json({ error }, { status: 422 });
  const nq = normalizeQuery(p.get("q"));
  if (nq.q === undefined) return bad(nq.error);
  const q = nq.q;
  const page = Number(p.get("page") ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 1000) return bad("page must be a whole number from 1 to 1000.");
  const rl = await rateCheck("search", clientKey(req.headers), SEARCHES_PER_MINUTE);
  if (!rl.ok) return Response.json({ error: `Too many searches. Please wait ${rl.retryAfterSec} seconds and try again.` }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec), "Cache-Control": "no-store" } });
  const r = await searchSections(q, page, PAGE_SIZE, { exact: p.get("exact") === "1" });
  if (!r.available) return Response.json({ searchAvailable: false, reason: r.reason, message: r.message, results: [], total: 0, page, pageSize: PAGE_SIZE, hasMore: false }, { headers: { "Cache-Control": "no-store" } });
  const scope = r.mode === "semantic" ? "meaning of Central and State Acts (English)" : "text of Central and State Acts (English)";
  return Response.json({ searchAvailable: true, scope, hindiNotSearchable: hasDevanagari(q), ...r },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
