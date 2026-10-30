// GET /api/judgments/search-text?q=<words, a question, or "an exact phrase">&mode=meaning|words&page=
// Search INSIDE Supreme Court judgments (English text): by meaning (voyage-4 query vector against the SC vector project) or by words (stripped word index, phrases verified in the text).
// 10 results per page, one result per judgment. Without the SC projects configured: 200 with available:false (never an error page). Shares the 30-searches-per-minute limit with the Acts search.
import { normalizeQuery } from "@/lib/acts/searchQuery.mjs";
import { clientKey } from "@/lib/acts/semantic.mjs";
import { rateCheck } from "@/lib/limits/counters";
import { LOOSE_NOTE } from "@/lib/acts/looseQuery.mjs";
import { cacheControlFor, fellBackBecause, type SemanticInfo } from "@/lib/acts/meaning.mjs";
import { meaningFellBack, meaningUsed } from "@/lib/acts/meaningLog";
import { scCase, scKeywordConfigured, scSemanticConfigured, scTextConfigured, searchJudgmentsByMeaning, searchJudgmentsByWords } from "@/lib/legal-data";

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
  let mode = wantWords ? (words ? "words" : "meaning") : meaning ? "meaning" : "words";
  let semantic: SemanticInfo | undefined;   // set when the reader asked for meaning and exact words answered because meaning search failed
  try {
    let hits: { caseId: string; chunk: number; page: number | null; text: string; score: number; count?: number }[] = [], total = 0, note = "", loose = false;
    const byWords = async () => { const r = await searchJudgmentsByWords(nq.q, PAGE * 20); hits = r.hits; total = r.total; loose = r.loose; note = r.loose ? LOOSE_NOTE : r.total > r.ranked ? `${r.total.toLocaleString("en-IN")} judgments contain these words; the ${r.ranked} best by the word index are ranked by how often the words occur.` : "Judgments containing all the words (word stems; put a phrase in quotes for an exact phrase), ranked by how often they occur."; };
    if (mode === "words") await byWords();
    else {
      try { hits = await searchJudgmentsByMeaning(nq.q, PAGE * 5); total = hits.length; note = "Passages closest in meaning to your question, one per judgment."; meaningUsed("judgments"); }
      catch (e) {
        const cause = meaningFellBack("judgments", e);
        if (!words) throw e;   // nothing to fall back to: the reader gets the plain "could not be reached" message below
        semantic = fellBackBecause(cause); mode = "words"; await byWords();
      }
    }
    const slice = hits.slice((page - 1) * PAGE, page * PAGE);
    const results = (await Promise.all(slice.map(async (h) => { const m = await scCase(h.caseId); return m ? { caseId: h.caseId, year: m.year, title: m.c.title, citation: m.c.citation ?? null, decisionDate: m.c.decisionDate ?? null, disposition: m.c.disposition ?? null, chunk: h.chunk, page: h.page, passage: h.text, count: h.count ?? null } : null; }))).filter(Boolean);
    return Response.json({ available: true, mode, results, total, page, pageSize: PAGE, hasMore: page * PAGE < hits.length, modes: { meaning, words }, note, ...(loose ? { loose } : {}), ...(semantic ? { semantic } : {}) }, { headers: { "Cache-Control": cacheControlFor(semantic) } });   // a fallback answer is never cached by the CDN
  } catch { return Response.json({ available: false, message: "Search inside judgments could not be reached. Please try again in a moment.", results: [], total: 0, page, pageSize: PAGE, hasMore: false }, { headers: { "Cache-Control": "no-store" } }); }
}
