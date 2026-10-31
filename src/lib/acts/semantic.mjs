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
/** Central Acts count this much more than State Acts when the query names no state. Set from the 65-question test (docs/SEMANTIC-ACTS.md). */
export const CENTRAL_SEMANTIC = 1.3;
/** When the query names a State, that State's Acts count this much more (and Central gets no boost). */
export const STATE_NAMED_SEMANTIC = 1.2;

/** State and UT names (and common spellings) -> the `acts.state` slug. Used to tell a question about one State's law ("rent control in Maharashtra") from a general one. */
const STATE_NAMES = {
  "andaman-nicobar": ["andaman", "nicobar"], "andhra-pradesh": ["andhra pradesh", "andhra"], "arunachal-pradesh": ["arunachal pradesh", "arunachal"], assam: ["assam"], bihar: ["bihar"],
  chandigarh: ["chandigarh"], chhattisgarh: ["chhattisgarh", "chattisgarh"], "dadra-nagar-haveli": ["dadra", "nagar haveli", "daman", "diu"], delhi: ["delhi", "nct"], goa: ["goa"],
  gujarat: ["gujarat"], haryana: ["haryana"], "himachal-pradesh": ["himachal pradesh", "himachal"], "jammu-kashmir": ["jammu", "kashmir", "j&k"], jharkhand: ["jharkhand"],
  karnataka: ["karnataka"], kerala: ["kerala"], ladakh: ["ladakh"], "madhya-pradesh": ["madhya pradesh"], maharashtra: ["maharashtra", "mumbai"], manipur: ["manipur"],
  meghalaya: ["meghalaya"], mizoram: ["mizoram"], nagaland: ["nagaland"], odisha: ["odisha", "orissa"], puducherry: ["puducherry", "pondicherry"], punjab: ["punjab"],
  rajasthan: ["rajasthan"], sikkim: ["sikkim"], "tamil-nadu": ["tamil nadu", "tamilnadu"], telangana: ["telangana"], tripura: ["tripura"], "uttar-pradesh": ["uttar pradesh"],
  uttarakhand: ["uttarakhand", "uttaranchal"], "west-bengal": ["west bengal"],
};
/** The states a query names, as a Set of slugs (empty for a general question). */
export function statesIn(q) {
  const t = ` ${q.toLowerCase().replace(/[^a-z0-9& ]+/g, " ").replace(/\s+/g, " ")} `, out = new Set();
  for (const [slug, names] of Object.entries(STATE_NAMES)) if (names.some((n) => t.includes(` ${n} `))) out.add(slug);
  return out;
}

/** An Act phrase with the states it names taken out: "Madhya Pradesh Indian Penal Code" -> { states: Set("madhya-pradesh"), rest: "Indian Penal Code" }. Used so that a question naming a state looks for THAT state's copy. */
export function splitStates(phrase) {
  let rest = ` ${String(phrase ?? "")} `;
  const states = new Set();
  for (const [slug, names] of Object.entries(STATE_NAMES)) for (const n of names) { const re = new RegExp(`(?<![A-Za-z])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z])`, "i"); if (re.test(rest)) { states.add(slug); rest = rest.replace(re, " "); } }
  return { states, rest: rest.replace(/\b(?:state|of)\b\s*$/i, "").replace(/\s+/g, " ").trim() };
}

/** Identity of "the same section of the same Act" across filings: Act title (case, "The", punctuation and a trailing year removed) + section number. The dataset files one Act many times
 *  (CrPC 1973 under 8 states, the Factories Act under 14); those copies share this key. Blocks without a section number are never merged (null). */
export function copyKey(title, number) {
  if (!number) return null;
  const t = String(title ?? "").toLowerCase().replace(/&/g, " and ").replace(/^\s*the\s+/, "").replace(/,?\s*\d+\s+of\s+\d{4}.*$/, "").replace(/[^a-z0-9]+/g, " ").replace(/\s*\b(1[89]|20)\d\d\s*$/, "").trim();
  return t ? `${t}|${String(number).toUpperCase()}` : null;
}

/** Orders candidate sections by similarity (1 - cosine distance) x status factor. cands: [{ actId, sectionKey, distance }];
 *  info: Map "actId|sectionKey" -> { actStatus, status, central, title, number, state }; boosts: { central, state, states: Set of state slugs the query names }.
 *  - candidates with no info row, and garbled sections (their text cannot be shown and their vector came from the damaged text), are dropped;
 *  - filings of the same section of the same Act (same copyKey) collapse into one result: the Central filing if there is one, else the best-scoring copy; it takes the group's best
 *    score and reports how many other copies were folded in (`copies`), so State copies of a Central Act never rank above it. */
export function rankSections(cands, info, limit = 60, factor = NOT_IN_FORCE_SEMANTIC, boosts = {}) {
  const { central = CENTRAL_SEMANTIC, state = STATE_NAMED_SEMANTIC, states = new Set() } = boosts;
  const groups = new Map();
  for (const c of cands) {
    const i = info.get(`${c.actId}|${c.sectionKey}`);
    if (!i || i.status === "garbled") continue;
    const score = (1 - c.distance) * (i.actStatus === "in_force" ? 1 : factor) * (states.size ? (i.state && states.has(i.state) ? state : 1) : (i.central ? central : 1)) * (boosts.adjust ? boosts.adjust(c, i) : 1);   // adjust: e.g. a section whose heading uses the query's own words (src/lib/acts/searchBoost.mjs)
    const item = { actId: c.actId, sectionKey: c.sectionKey, score, central: !!i.central, copies: 0 };
    const k = copyKey(i.title, i.number) ?? `${c.actId}|${c.sectionKey}`, g = groups.get(k);
    if (!g) { groups.set(k, item); continue; }
    const best = Math.max(g.score, score), keepNew = (item.central && !g.central) || (item.central === g.central && score > g.score);
    const rep = keepNew ? item : g;
    rep.score = best; rep.copies = g.copies + 1; groups.set(k, rep);
  }
  const key = (r) => `${r.actId}|${r.sectionKey}`;
  return [...groups.values()].sort((a, b) => b.score - a.score || (key(a) < key(b) ? -1 : 1)).slice(0, limit);
}
const STOP = new Set("a an and are as at be by can do does for from has have how i if in is it its my of on or the to what when where which who whom why will with would you your".split(" "));
/** "word or word or ..." for websearch_to_tsquery: highlights the question's own words in a snippet. "" when nothing is left. */
export function highlightQuery(q) {
  const words = [...new Set(q.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))].slice(0, 12);
  return words.join(" or ");
}
