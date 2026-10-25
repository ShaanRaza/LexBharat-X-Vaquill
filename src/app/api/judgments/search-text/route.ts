// GET /api/judgments/search-text?q=<words, a question, or "an exact phrase">&mode=meaning|words&page=
// Search INSIDE Supreme Court judgments (English text): by meaning (voyage-4 query vector against the SC vector project) or by words (stripped word index, phrases verified in the text).
// 10 results per page, one result per judgment. Without the SC projects configured: 200 with available:false (never an error page). Shares the 30-searches-per-minute limit with the Acts search.
import { normalizeQuery } from "@/lib/acts/searchQuery.mjs";
import { clientKey } from "@/lib/acts/semantic.mjs";
import { rateCheck } from "@/lib/limits/counters";
import { scKeywordConfigured, scSemanticConfigured, scTextConfigured, searchJudgmentsByMeaning, searchJudgmentsByWords } from "@/lib/judgments/scText";
import { scCase } from "@/lib/judgments/scMeta";

const PAGE = 10;
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams, bad = (error: string) => Response.json({ error }, { status: 422 });
  const nq = normalizeQuery(p.get("q"));
  if (nq.q === undefined) return bad(nq.error);
  const page = Number(p.get("page") ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 20) return bad("page must be a whole number from 1 to 20.");
  const wantWords = p.get("mode") === "words", words = scKeywordConfigured(), meaning = scSemanticConfigured();
  if (!scTextConfigured() || (!words && !meaning)) return Response.json({ available: false, message: "Search inside judgments is not set up on this site yet.", results: [], total: 0, page, pageSize: PAGE, hasMore: false }, { headers: { "Cache-Control": "no-store" } });
  const rl = await rateCheck("search", clientKey(req.headers), 30);
  if (!rl.ok) return Response.json({ error: `Too many searches. Please wait ${rl.retryAfterSec} seconds and try again.` }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec), "Cache-Control": "no-store" } });
  const mode = wantWords ? (words ? "words" : "meaning") : meaning ? "meaning" : "words";
  try {
    let hits: { caseId: string; chunk: number; page: number | null; text: string; score: number; count?: number }[], total: number, note: string;
    if (mode === "words") { const r = await searchJudgmentsByWords(nq.q, PAGE * 20); hits = r.hits; total = r.total; note = r.total > r.ranked ? `${r.total.toLocaleString("en-IN")} judgments contain these words; the ${r.ranked} best by the word index are ranked by how often the words occur.` : "Judgments containing all the words (word stems; put a phrase in quotes for an exact phrase), ranked by how often they occur."; }
    else { hits = await searchJudgmentsByMeaning(nq.q, PAGE * 5); total = hits.length; note = "Passages closest in meaning to your question, one per judgment."; }
    const slice = hits.slice((page - 1) * PAGE, page * PAGE);
    const results = (await Promise.all(slice.map(async (h) => { const m = await scCase(h.caseId); return m ? { caseId: h.caseId, year: m.year, title: m.c.title, citation: m.c.citation ?? null, decisionDate: m.c.decisionDate ?? null, disposition: m.c.disposition ?? null, chunk: h.chunk, page: h.page, passage: h.text, count: h.count ?? null } : null; }))).filter(Boolean);
    return Response.json({ available: true, mode, results, total, page, pageSize: PAGE, hasMore: page * PAGE < hits.length, modes: { meaning, words }, note }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
  } catch { return Response.json({ available: false, message: "Search inside judgments could not be reached. Please try again in a moment.", results: [], total: 0, page, pageSize: PAGE, hasMore: false }, { headers: { "Cache-Control": "no-store" } }); }
}
