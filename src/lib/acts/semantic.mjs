// Pure helpers for search by meaning (semantic search) over Central Act sections. No database, no network, no styling.
// Used by src/lib/acts/searchStore.ts, src/lib/acts/embed.ts and the /api/acts/search route; tested in semantic.test.mjs.

/** A query containing "an exact phrase" in straight or curly quotes is a keyword search, never a semantic one. */
export const hasQuotedPhrase = (q) => /["“”][^"“”]{2,}["“”]/.test(q);

/** Chooses how a query is searched, given what the caller already knows. Section lookups ("138 NI Act") are decided before this and never reach it.
 *  Returns "semantic" or "text", plus a short reason code for the "text" cases. */
export function chooseMode(q, { exact = false, hindi = false, semanticReady = true } = {}) {
  if (exact) return { mode: "text", reason: "exact_requested" };
  if (hasQuotedPhrase(q)) return { mode: "text", reason: "quoted_phrase" };
  if (hindi) return { mode: "text", reason: "hindi" };
  if (!semanticReady) return { mode: "text", reason: "semantic_unavailable" };
  return { mode: "semantic", reason: null };
}

/** Normal form of a query for caching: case, spacing and trailing punctuation do not change the embedding that matters. */
export const cacheKey = (q) => q.toLowerCase().replace(/\s+/g, " ").trim();

/** Small least-recently-used map. */
export class LruCache {
  constructor(max = 500) { this.max = max; this.map = new Map(); }
  get(k) { if (!this.map.has(k)) return undefined; const v = this.map.get(k); this.map.delete(k); this.map.set(k, v); return v; }
  set(k, v) { this.map.delete(k); this.map.set(k, v); while (this.map.size > this.max) this.map.delete(this.map.keys().next().value); }
  get size() { return this.map.size; }
}

/** Sliding-window rate limiter. check(key) -> { ok, retryAfterSec }. `now` is injectable for tests. State is per process (per serverless instance). */
export function createRateLimiter({ limit = 30, windowMs = 60000, maxKeys = 5000, now = () => Date.now() } = {}) {
  const hits = new Map();
  return {
    check(key) {
      const t = now(), cutoff = t - windowMs;
      const list = (hits.get(key) ?? []).filter((x) => x > cutoff);
      if (list.length >= limit) { hits.set(key, list); return { ok: false, retryAfterSec: Math.max(1, Math.ceil((list[0] + windowMs - t) / 1000)) }; }
      list.push(t); hits.delete(key); hits.set(key, list);
      if (hits.size > maxKeys) for (const k of hits.keys()) { if (hits.size <= maxKeys) break; hits.delete(k); }
      return { ok: true, retryAfterSec: 0 };
    },
  };
}

/** The caller's address from proxy headers (the first x-forwarded-for entry), else a shared "unknown" bucket. */
export function clientKey(headers) {
  const xf = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (xf || headers.get("x-real-ip")?.trim() || "unknown").slice(0, 64);
}

/** pgvector text form of a vector: "[0.1,0.2,...]". */
export const vectorLiteral = (v) => `[${Array.from(v, (n) => +Number(n).toFixed(7)).join(",")}]`;

/** Nearest chunks (best first) -> distinct sections (best chunk's rank order), at most `limit`. rows: [{ actId, sectionKey }]. */
export function distinctSections(rows, limit = 60) {
  const seen = new Set(), out = [];
  for (const r of rows) { const k = `${r.actId}|${r.sectionKey}`; if (seen.has(k)) continue; seen.add(k); out.push({ actId: r.actId, sectionKey: r.sectionKey, distance: r.distance }); if (out.length >= limit) break; }
  return out;
}

/** Acts that are not in force (repealed, spent) count 0.9x. On the 50-question test over all Central Acts this took top-1 from 56% to 66% and top-5 from 96% to 98%
 *  (docs/SEMANTIC-ACTS.md); the factor is mild on purpose, so a repealed Act still shows when it is clearly the best match. */
export const NOT_IN_FORCE_SEMANTIC = 0.9;

/** Orders candidate sections by similarity (1 - cosine distance) x status factor. cands: [{ actId, sectionKey, distance }]; info: Map "actId|sectionKey" -> { actStatus, status }.
 *  Candidates with no info row, and garbled sections (their text cannot be shown and their vector came from the damaged text), are dropped. */
export function rankSections(cands, info, limit = 60, factor = NOT_IN_FORCE_SEMANTIC) {
  const scored = [];
  for (const c of cands) {
    const i = info.get(`${c.actId}|${c.sectionKey}`);
    if (!i || i.status === "garbled") continue;
    scored.push({ actId: c.actId, sectionKey: c.sectionKey, score: (1 - c.distance) * (i.actStatus === "in_force" ? 1 : factor) });
  }
  return scored.sort((a, b) => b.score - a.score || (a.actId < b.actId ? -1 : a.actId > b.actId ? 1 : a.sectionKey < b.sectionKey ? -1 : 1)).slice(0, limit);
}

const STOP = new Set("a an and are as at be by can do does for from has have how i if in is it its my of on or the to what when where which who whom why will with would you your".split(" "));
/** "word or word or ..." for websearch_to_tsquery: highlights the question's own words in a snippet. "" when nothing is left. */
export function highlightQuery(q) {
  const words = [...new Set(q.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))].slice(0, 12);
  return words.join(" or ");
}
