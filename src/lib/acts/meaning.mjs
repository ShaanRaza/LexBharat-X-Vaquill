// What happens when search by meaning cannot run (Voyage busy, a vector store down, not set up) and keyword search answers instead. PURE logic: no network, no database, no styling.
// ONE place decides three things for every search surface (Acts, regulators, Supreme Court judgments, Ask, Vault): why it failed (causeOf), what the reader is told (FALLBACK_NOTICE) and whether the answer may be cached (cacheControlFor).
// The server side that counts and logs a fallback is src/lib/acts/meaningLog.ts; src/lib/acts/meaning.test.mjs fails if a search path that embeds a query does not use it.

/** The words shown to the reader when "By meaning" was asked for (or is the default) and exact-word results were shown instead, for the cause "busy". Other causes say their own reason: see whyFor. */
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
/** The reader-facing reason for each cause, in three families: the limit was reached (Voyage answered 429), it is not set up or the provider refused the key or plan, or it is busy (slow, down, unreachable, a wrong answer). */
export function whyFor(cause) {
  switch (cause) {
    case "rate_limited": return { family: "limit", clause: "meaning search has reached its request limit for now", short: "its request limit is reached" };
    case "not_configured": return { family: "not_set_up", clause: "meaning search is not set up here", short: "it is not set up here" };
    case "voyage_refused": return { family: "not_set_up", clause: "meaning search was refused by its provider (check the key or plan)", short: "its provider refused the request" };
    case "timeout": return { family: "busy", clause: "meaning search took too long", short: "it took too long" };
    default: return { family: "busy", clause: "meaning search is busy", short: "it is busy" };
  }
}
/** What to tell the reader about a result, or "" when nothing needs saying. The text names the real cause. */
export const noticeFor = (semantic) => {
  if (!isFallback(semantic)) return "";
  if (semantic.reason === "semantic_unavailable" || semantic.cause === "not_configured") return UNAVAILABLE_NOTICE;
  return `Showing exact-word results — ${whyFor(semantic.cause).clause}.`;
};

/** Ask: what to tell the reader when some of the searches behind an answer fell back to exact words. meaning = { used, fellBack, cause, judgmentsFailed, judgmentsCause, judgmentsRecovered } from src/lib/chat/retrieve.ts. */
export function askNoticeFor(meaning) {
  if (!meaning) return "";
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1), parts = [];
  if (meaning.fellBack > 0) parts.push(`${cap(whyFor(meaning.cause).clause)}, so ${meaning.used > 0 ? "some of" : "all of"} the sections below were found by exact words only and may be less complete.`);
  if (meaning.judgmentsFailed) {
    const same = meaning.fellBack > 0 && meaning.judgmentsCause === meaning.cause, tail = meaning.judgmentsRecovered ? "were found by exact words only and may be less relevant" : "were left out of this answer";
    parts.push(same ? `The Supreme Court passages ${tail} for the same reason.` : `${cap(whyFor(meaning.judgmentsCause).clause)}, so the Supreme Court passages ${tail}.`);
  }
  return parts.join(" ");
}
/** Vault: what to tell the reader when an attached document was searched by keywords because meaning search failed (cause from meaningFellBack("vault", e)). */
export const docNoticeFor = (cause) => `Your document was searched by keywords because ${whyFor(cause).clause}.`;

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
