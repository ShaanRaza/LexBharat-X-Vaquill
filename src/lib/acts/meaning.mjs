// What happens when search by meaning cannot run (Voyage busy, a vector store down, not set up) and keyword search answers instead. PURE logic: no network, no database, no styling.
// ONE place decides three things for every search surface (Acts, regulators, Supreme Court judgments, Ask, Vault): why it failed (causeOf), what the reader is told (FALLBACK_NOTICE) and whether the answer may be cached (cacheControlFor).
// The server side that counts and logs a fallback is src/lib/acts/meaningLog.ts; src/lib/acts/meaning.test.mjs fails if a search path that embeds a query does not use it.

/** The words shown to the reader when "By meaning" was asked for (or is the default) and exact-word results were shown instead. */
export const FALLBACK_NOTICE = "Showing exact-word results — meaning search is busy.";
/** When search by meaning is not set up at all (no Voyage key or no vector database). */
export const UNAVAILABLE_NOTICE = "Search by meaning is not set up here, so this is a keyword search.";

/** Why a search by meaning failed, from the error that was thrown. The names are what /admin and the logs show. */
export function causeOf(err) {
  const name = String(err?.name ?? ""), msg = String(err?.message ?? err ?? "");
  const v = /^voyage (\d{3})$/.exec(msg);
  if (v) return v[1] === "429" ? "rate_limited" : /^5/.test(v[1]) ? "voyage_down" : "voyage_refused";
  if (/^voyage unreachable$/.test(msg)) return "voyage_down";
  if (/no voyage key/i.test(msg)) return "not_configured";
  if (/unexpected vectors/i.test(msg)) return "voyage_bad_answer";
  if (name === "TimeoutError" || name === "AbortError" || /timed out|timeout|aborted/i.test(msg)) return "timeout";
  if (/Neon|qdrant|vector store|statement timeout|canceling statement|fetch failed|ECONN|ENOTFOUND|connect/i.test(`${name} ${msg}`)) return "vector_store";
  return "other";
}
export const CAUSES = ["rate_limited", "timeout", "voyage_down", "voyage_refused", "voyage_bad_answer", "vector_store", "not_configured", "other"];
export const CAUSE_LABEL = { rate_limited: "Voyage rate limit", timeout: "Timed out", voyage_down: "Voyage error (5xx)", voyage_refused: "Voyage refused (key or plan)", voyage_bad_answer: "Voyage sent a wrong-size vector", vector_store: "Vector database", not_configured: "Not set up", other: "Other" };

/** The text safe to write to a log for a failure: our own short messages only, never a connection string, a key or the query. */
export const safeDetail = (err) => { const m = String(err?.message ?? err ?? ""); return /^(voyage \d{3}|voyage unreachable|no voyage key|voyage returned unexpected vectors|no vector store answered)$/.test(m) ? m : String(err?.name ?? "Error").slice(0, 40); };

/** The `semantic` field of a search result when keyword search ran instead of meaning search. */
export const fellBackBecause = (cause) => ({ used: false, reason: cause === "not_configured" ? "semantic_unavailable" : "semantic_error", cause });
/** True when a result is a keyword search that stands in for a meaning search that failed (not one the reader asked for, such as exact words or a quoted phrase). */
export const isFallback = (semantic) => !!semantic && semantic.used === false && (semantic.reason === "semantic_error" || semantic.reason === "semantic_unavailable");
/** What to tell the reader about a result, or "" when nothing needs saying. */
export const noticeFor = (semantic) => (!isFallback(semantic) ? "" : semantic.reason === "semantic_unavailable" ? UNAVAILABLE_NOTICE : FALLBACK_NOTICE);

/** Ask: what to tell the reader when some of the searches behind an answer fell back to exact words. meaning = { used, fellBack, judgmentsFailed } from src/lib/chat/retrieve.ts. */
export function askNoticeFor(meaning) {
  if (!meaning) return "";
  if (meaning.fellBack > 0) return `Meaning search is busy, so ${meaning.used > 0 ? "some of" : "all of"} the sections below were found by exact words only and may be less complete.`;
  if (meaning.judgmentsFailed) return "Meaning search is busy, so Supreme Court passages were left out of this answer.";
  return "";
}

/** Cache-Control for a search response. A keyword answer that stands in for a failed meaning search must NOT be kept by the CDN, or one busy moment is served to everyone for minutes. */
export function cacheControlFor(semantic, shared = "public, s-maxage=300, stale-while-revalidate=3600") {
  return isFallback(semantic) && semantic.reason === "semantic_error" ? "no-store" : shared;
}

/** Counter rows [{ metric: "meaning_search" | "meaning_fallback", key, n }] (key "<surface>:<cause>" for a fallback, "<surface>" for a search) -> per surface { searches, fellBack, pct, causes }. */
export function meaningStats(rows) {
  const by = new Map(), get = (s) => by.get(s) ?? by.set(s, { surface: s, searches: 0, fellBack: 0, causes: {} }).get(s);
  for (const r of rows) {
    const n = Number(r.n) || 0;
    if (r.metric === "meaning_search") get(String(r.key).split(":")[0]).searches += n;
    else if (r.metric === "meaning_fallback") { const [s, c = "other"] = String(r.key).split(":"), e = get(s); e.fellBack += n; e.causes[c] = (e.causes[c] ?? 0) + n; }
  }
  return [...by.values()].map((e) => { const searches = Math.max(e.searches, e.fellBack); return { ...e, searches, pct: searches ? Math.round((1000 * e.fellBack) / searches) / 10 : 0 }; }).sort((a, b) => b.searches - a.searches);
}
