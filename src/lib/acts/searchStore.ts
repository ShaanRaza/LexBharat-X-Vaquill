// Keyword search over Act section text in Neon (Postgres full-text search, 'english' config). LOGIC ONLY: no styling. The caller (route handler) validates input.
import { query, dbConfigured } from "./db";
import { actMatcher, hasDevanagari, hasSearchableChars, parseSectionLookup } from "./searchQuery.mjs";
import { unitLabel } from "./unitLabel.mjs";
import { knownMaxFor } from "./knownCounts.mjs";
import { cleanPlain } from "@/lib/text/clean.mjs";
import { displayTitle } from "@/lib/docs/docType.mjs";
import { dedupeCopies } from "./dedupe.mjs";
import { contentTokens, contentWords, expandQuery, hybridOrder, lexicalBoost } from "./searchBoost.mjs";
import { currentLawFirst, pairFor } from "./currentLaw.mjs";
import { extractLookups } from "./lookups.mjs";
import synonyms from "@/config/search-synonyms.json";
import replacedLaws from "@/config/replaced-laws.json";
import { chooseMode, distinctSections, highlightQuery, rankSections, statesIn } from "./semantic.mjs";
import { embedMany, embedQuery, voyageConfigured } from "./embed";
import { vectorStores, vectorConfigured } from "./vectorStore";
import { fellBackBecause, type SemanticInfo } from "./meaning.mjs";
import { LOOSE_BELOW, LOOSE_NOTE, LOOSE_NOTE_FEW, looseTermsFor } from "./looseQuery.mjs";
import { meaningFellBack, meaningPartial, meaningUsed, type Surface } from "./meaningLog";

/** The same weighted text-search vector the view act_sections_v builds for a hand-filled section (heading weighs more than the body). */
const SUPP_TSV = `(setweight(to_tsvector('english', coalesce(x.heading, '')), 'A') || setweight(to_tsvector('english', left(x.body, 600000)), 'B'))`;
export const MARK_OPEN = "", MARK_CLOSE = ""; // private-use markers around matched words in snippets; the UI turns them into highlights
export const PAGE_SIZE = 12, MAX_RESULTS = 1000;
/** Re-ranking of the best 1,000 text matches for broad queries: a match whose whole query is in the heading counts 1.6x, a Central Act 1.3x, an Act no longer in force 0.75x. Exact section lookups never go through this. */
export const HEADING_BOOST = 1.6, CENTRAL_BOOST = 1.3, NOT_IN_FORCE_FACTOR = 0.75;
const RANK_BOOST = `(CASE WHEN to_tsvector('english', coalesce(s.heading, '')) @@ q.tq THEN ${HEADING_BOOST} ELSE 1 END) * (CASE WHEN a.category = 'central' THEN ${CENTRAL_BOOST} ELSE 1 END) * (CASE WHEN a.act_status = 'in_force' THEN 1 ELSE ${NOT_IN_FORCE_FACTOR} END)`;

export type SectionHit = {
  actId: string; actTitle: string; year: number | null; category: string; state: string | null; actStatus: string; sourceUrl: string | null;
  sectionKey: string; number: string | null; heading: string | null; chapter: string | null; status: string; flags: string[];
  snippet: string; via: "text" | "lookup" | "semantic";
  /** Semantic results only: how many other filings of this same section (the same Act filed under other states) were folded into this one. */
  copies?: number;
  /** Regulator, Law Commission and tribunal-filed instruments only: the body's slug (sebi, rbi, law-commission ...). */
  department?: string | null;
};
/** Optional narrowing of a search: Central or State Acts, in force or repealed. */
export type SearchFilters = { jurisdiction?: "central" | "state"; status?: "in_force" | "repealed" };
const filterSql = (f: SearchFilters = {}, a = "a") => [f.jurisdiction === "central" ? `${a}.category = 'central'` : f.jurisdiction === "state" ? `${a}.category = 'state'` : "", f.status === "in_force" ? `${a}.act_status = 'in_force'` : f.status === "repealed" ? `${a}.act_status <> 'in_force'` : ""].filter(Boolean).join(" AND ");
const passes = (f: SearchFilters, m: { central: boolean; actStatus: string }) => (!f.jurisdiction || (f.jurisdiction === "central") === m.central) && (!f.status || (f.status === "in_force") === (m.actStatus === "in_force"));

export type SearchOutcome =
  | { available: false; reason: "not_configured" | "unreachable"; message: string }
  | { available: true; results: SectionHit[]; total: number; totalCapped: boolean; page: number; pageSize: number; hasMore: boolean; mode: "text" | "lookup" | "semantic"; note: string;
      /** How the query was searched: used=true for search by meaning; otherwise why keyword search ran instead (exact_requested, quoted_phrase, hindi, semantic_unavailable, semantic_error) and, for the last two, the cause (src/lib/acts/meaning.mjs). */
      semantic?: SemanticInfo;
      /** Set when no result had all the words and these match only some of them (looseQuery.mjs). */
      loose?: boolean;
      /** Set when the asked-for section number is confidently missing from our data (gaps.mjs): the UI shows the notice and the India Code link. */
      missing?: { actTitle: string; actId: string; number: string; sourceUrl: string | null; /** the number is above the Act's last section: there is no such section (the highest number it has) */ beyond?: number | null } };

/** First readable words of a section for a lookup result: skips markdown headings and all-capitals heading lines that lead some sections. */
/** A snippet is shown to readers: the shared display layer cleans it (the highlight marks are private-use characters and pass through). */
const tidy = (s: string) => cleanPlain(s);
const leadSnippet = (body: string) => tidy(body.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p && !/^#/.test(p) && !(p.length < 200 && p === p.toUpperCase())).join(" ")).replace(/\s+/g, " ").slice(0, 220);

const COLS = `s.act_id AS "actId", a.title AS "actTitle", a.year, a.category, a.state, a.act_status AS "actStatus", a.source_url AS "sourceUrl", s.section_key AS "sectionKey", s.number, s.heading, s.chapter, s.status, s.flags`;

export const searchAvailable = () => dbConfigured();

async function lookupHits(q: string, page: number, pageSize: number, filters: SearchFilters = {}): Promise<SearchOutcome | null> {
  const lk = parseSectionLookup(q);
  if (!lk) return null;
  const m = actMatcher(lk.actPhrase);
  const where = m.titlePrefix ? `lower(a.title) LIKE $1 || '%'` : m.words.map((_, i) => `a.title ILIKE '%' || $${i + 1} || '%'`).join(" AND ");
  const params: unknown[] = m.titlePrefix ? [m.titlePrefix] : m.words;
  if (!params.length) return null;
  const rows = await query<Omit<SectionHit, "snippet" | "via"> & { body: string | null }>(
    `SELECT ${COLS}, left(s.body, 400) AS body FROM acts a JOIN act_sections_v s ON s.act_id = a.act_id
     WHERE ${where} AND upper(s.number) = ANY($${params.length + 1}::text[])${filterSql(filters) ? ` AND ${filterSql(filters)}` : ""}
     ORDER BY (a.category = 'central') DESC, (a.act_status = 'in_force') DESC, length(a.title), s.ord LIMIT 24`, [...params, (lk.numbers ?? [lk.number]).map((n: string) => n.toUpperCase())]);
  if (!rows.length) {
    const num = /^\d{1,4}$/.test(lk.number) ? Number(lk.number) : null;
    if (num === null) return null;
    const gone = await query<{ actId: string; actTitle: string; sourceUrl: string | null }>(
      `SELECT a.act_id AS "actId", a.title AS "actTitle", a.source_url AS "sourceUrl" FROM acts a JOIN act_missing_sections m ON m.act_id = a.act_id WHERE ${where} AND m.number = $${params.length + 1}
       ORDER BY (a.category = 'central') DESC, (a.act_status = 'in_force') DESC, length(a.title) LIMIT 1`, [...params, num]).catch(() => []);
    // not recorded as missing: still, an Act we hold whose numbers do not include this one is "not in our library", never a section to answer from memory
    const held = gone.length ? gone : await query<{ actId: string; actTitle: string; sourceUrl: string | null }>(
      `SELECT a.act_id AS "actId", a.title AS "actTitle", a.source_url AS "sourceUrl" FROM acts a WHERE ${where} AND EXISTS (SELECT 1 FROM act_sections_v s WHERE s.act_id = a.act_id AND s.number ~ '^[0-9]')
       ORDER BY (a.category = 'central') DESC, (a.act_status = 'in_force') DESC, length(a.title) LIMIT 1`, params).catch(() => []);
    if (!held.length) return null;
    // a number above the Act's last section is not "missing": there is no such section. The last section is the reference count for well-known Acts, else the highest number we hold (only when the number is far above it)
    const top = (await query<{ m: number | null }>(`SELECT max((substring(number from '^[0-9]+'))::int) AS m FROM act_sections_v WHERE act_id = $1 AND number ~ '^[0-9]{1,3}' AND body IS NOT NULL`, [held[0].actId]).catch(() => []))[0]?.m ?? 0;
    const known = knownMaxFor(held[0].actTitle), beyond = known ? (num > known ? known : null) : top && num > top * 2 + 20 ? top : null;
    return { available: true, results: [], total: 0, totalCapped: false, page, pageSize, hasMore: false, mode: "lookup", note: beyond ? `${held[0].actTitle} has no Section ${lk.number}: its sections end at ${beyond}.` : `Section ${lk.number} of ${held[0].actTitle} is missing from our source data.`, missing: { ...held[0], number: lk.number, beyond } };
  }
  const all = rows.map(({ body, ...r }): SectionHit => ({ ...r, snippet: leadSnippet(body ?? ""), via: "lookup" }));
  const slice = all.slice((page - 1) * pageSize, page * pageSize);
  return { available: true, results: slice, total: all.length, totalCapped: false, page, pageSize, hasMore: page * pageSize < all.length, mode: "lookup", note: `Lookup: ${unitLabel(lk.number)?.toLowerCase() ?? `section ${lk.number}`} of the Act matching "${lk.actPhrase}".` };
}

async function textSearch(q: string, page: number, pageSize: number, filters: SearchFilters = {}, opts: { loose?: boolean } = {}): Promise<SearchOutcome> {
  const strict = await textSearchOnce(q, page, pageSize, filters, null);
  if (opts.loose === false || !strict.available || page !== 1) return strict;
  // A sentence-style question usually has a word no section contains: with every word required, nothing, or only a few odd sections, is found. So the search is repeated requiring none of the words,
  // ranked by how many of them (and their statutory synonyms) a section holds (looseQuery.mjs looseTermsFor decides when).
  const terms = looseTermsFor(q, strict.results.length, { expand: (x) => expandQuery(x, synonyms.rules).text });
  if (!terms) return strict;
  const loose = await textSearchOnce(terms.join(" | "), page, pageSize, filters, terms);
  if (!loose.available || !loose.results.length) return strict;
  const few = strict.results.length < LOOSE_BELOW;
  return { ...loose, ...(few ? { loose: true, note: strict.results.length ? LOOSE_NOTE_FEW : LOOSE_NOTE } : { note: strict.note }), total: Math.max(loose.total, strict.total) };
}

/** One keyword pass. terms = null: every word required (websearch_to_tsquery). terms = [..]: q is the OR query of these words and a section ranks higher the more of them it holds. */
async function textSearchOnce(q: string, page: number, pageSize: number, filters: SearchFilters, terms: string[] | null): Promise<SearchOutcome> {
  const loose = !!terms;
  try {
    const empty = (note: string): SearchOutcome => ({ available: true, results: [], total: 0, totalCapped: false, page, pageSize, hasMore: false, mode: "text", note });
    if (!hasSearchableChars(q)) return empty("The search has no letters or numbers to look for.");
    const offset = (page - 1) * pageSize;
    if (offset >= MAX_RESULTS) return empty(`Only the first ${MAX_RESULTS} matches can be paged through. Narrow the search.`);
    const rows = await query<Omit<SectionHit, "via"> & { total: string | number }>(
      `WITH q AS (SELECT ${loose ? "to_tsquery('english', $1)" : "websearch_to_tsquery('english', $1)"} AS tq),
            c AS MATERIALIZED (SELECT u.act_id, u.section_key, u.base FROM (
                -- the open-india-law rows use their GIN index directly (not through the view, which would lose it); the few hand-filled sections are searched on the fly
                SELECT s.act_id, s.section_key, ts_rank_cd(s.tsv, q.tq, 32) AS base FROM act_sections s, q WHERE s.tsv @@ q.tq
                  AND NOT EXISTS (SELECT 1 FROM act_sections_supplement r WHERE r.act_id = s.act_id AND r.replaces AND upper(r.number) = upper(s.number))
                  AND NOT EXISTS (SELECT 1 FROM act_copy_of c JOIN act_sections_supplement r ON r.act_id = c.central_id WHERE c.copy_id = s.act_id AND upper(r.number) = upper(s.number))
                UNION ALL
                SELECT x.act_id, x.section_key, ts_rank_cd(${SUPP_TSV}, q.tq, 32) FROM act_sections_supplement x, q WHERE ${SUPP_TSV} @@ q.tq
              ) u ORDER BY u.base DESC, u.act_id, u.section_key LIMIT ${MAX_RESULTS + 1}),
            m AS MATERIALIZED (SELECT c.act_id, c.section_key, c.base * ${RANK_BOOST}${loose ? " * power((SELECT count(*) FROM unnest($4::text[]) t WHERE s.tsv @@ to_tsquery('english', t)), 2)" : ""} AS rank FROM c JOIN act_sections_v s USING (act_id, section_key) JOIN acts a ON a.act_id = s.act_id, q${filterSql(filters) ? ` WHERE ${filterSql(filters)}` : ""}),
            p AS (SELECT *, (SELECT count(*) FROM m) AS total FROM m ORDER BY rank DESC, act_id, section_key OFFSET $2 LIMIT $3)
       SELECT ${COLS}, p.total,
              ts_headline('english', left(s.body, 20000), q.tq, 'MaxFragments=2, MaxWords=26, MinWords=10, ShortWord=2, FragmentDelimiter=" … ", StartSel=${MARK_OPEN}, StopSel=${MARK_CLOSE}') AS snippet
       FROM p JOIN act_sections_v s USING (act_id, section_key) JOIN acts a ON a.act_id = s.act_id, q ORDER BY p.rank DESC, s.act_id, s.ord`, loose ? [q, offset, pageSize, terms] : [q, offset, pageSize], 15000);
    const total = rows.length ? Number(rows[0].total) : 0, capped = total > MAX_RESULTS;
    const results = rows.map(({ total: _t, ...r }): SectionHit => ({ ...r, snippet: tidy(r.snippet ?? ""), via: "text" }));
    if (!rows.length && page === 1) {
      // distinguish "nothing matches" from "a Hindi word, which is not searchable yet"
      return empty(hasDevanagari(q) ? "Hindi text is not searchable yet: section text is searched in English only." : "No section matches. Try fewer or different words, or put an exact phrase in quotes.");
    }
    return { available: true, results, total: Math.min(total, MAX_RESULTS), totalCapped: capped, page, pageSize, hasMore: offset + results.length < Math.min(total, MAX_RESULTS), mode: "text", note: 'Searches the text of Central and State Acts (English). Words are matched by stem ("dishonoured" finds "dishonour"); put a phrase in quotes for an exact phrase.' };
  } catch (e) {
    return { available: false, reason: "unreachable", message: "Section search could not be reached. Please try again in a moment." };
  }
}

// ---- Hindi (Devanagari) keyword search: only over sections whose Hindi text the site shows (act_sections_hi, scripts/w10/hindi-index.mjs), 'simple' full-text config (no stemming).
const HI_SPLIT = /[^\p{L}\p{N}\p{M}]+/u;   // letters, digits and combining marks (vowel signs) make a word
async function hindiSearch(q: string, page: number, pageSize: number): Promise<SearchOutcome> {
  const empty = (note: string): SearchOutcome => ({ available: true, results: [], total: 0, totalCapped: false, page, pageSize, hasMore: false, mode: "text", note });
  const words = [...new Set(q.toLowerCase().split(HI_SPLIT).filter(Boolean))].slice(0, 8);
  try {
    const offset = (page - 1) * pageSize;
    const rows = await query<Omit<SectionHit, "via"> & { total: string | number; body: string | null }>(
      `WITH m AS MATERIALIZED (SELECT act_id, section_key FROM act_sections_hi WHERE words @> $1::text[]),
            p AS (SELECT *, (SELECT count(*) FROM m) AS total FROM m ORDER BY act_id, section_key OFFSET $2 LIMIT $3)
       SELECT ${COLS}, p.total, left(s.body, 20000) AS body FROM p JOIN act_sections_v s USING (act_id, section_key) JOIN acts a ON a.act_id = s.act_id ORDER BY s.act_id, s.ord`, [words, offset, pageSize], 15000);
    const total = rows.length ? Number(rows[0].total) : 0;
    if (!rows.length && page === 1) return empty("No section with Hindi text matches. Hindi is searched only in the few hundred sections where we show Hindi text, by exact word forms; for English text, search in English.");
    const snippet = (body: string) => {
      const low = body.toLowerCase(), at = Math.max(0, Math.min(...words.map((w) => low.indexOf(w)).filter((i) => i >= 0)));
      let out = body.slice(Math.max(0, at - 80), at + 200).replace(/\s+/g, " ");
      for (const w of words) out = out.split(w).join(`${MARK_OPEN}${w}${MARK_CLOSE}`);
      return out;
    };
    return { available: true, results: rows.map(({ total: _t, body, ...r }): SectionHit => ({ ...r, snippet: snippet(body ?? ""), via: "text" })), total, totalCapped: false, page, pageSize, hasMore: offset + rows.length < total, mode: "text",
      note: "Searches the Hindi text we show (a few hundred sections), by exact word forms as shown (the source Hindi has lost some joined letters, so some words look misspelled). English text is searched in English." };
  } catch { return { available: false, reason: "unreachable", message: "Section search could not be reached. Please try again in a moment." }; }
}

// ---- search by meaning (Central + State Acts). Query -> voyage-4 -> nearest chunks from each corpus's vector store (src/lib/acts/vectorStore.ts) -> distinct sections ->
// metadata and snippets from the section database.
export const SEM_CHUNKS = 200, SEM_POOL = 300, SEM_MAX = 60;
export const semanticReady = () => voyageConfigured() && vectorConfigured();
const SEMANTIC_NOTE = 'Ranked by meaning, over Central and State Acts. For exact words use a "quoted phrase" or "Search exact words".';

/** Keys ("actId|sectionKey") whose own vectors must be ignored because a hand-filled section took their place: replaced rows, and the same-numbered rows of State-filed copies of the Act. Cached for a minute. */
let replacedCache: { at: number; keys: Set<string> } | null = null;
async function replacedKeys(): Promise<Set<string>> {
  if (replacedCache && Date.now() - replacedCache.at < 60000) return replacedCache.keys;
  const rows = await query<{ k: string }>(
    `SELECT act_id || '|' || section_key AS k FROM act_sections_supplement WHERE replaces
     UNION SELECT c.copy_id || '|' || s.section_key FROM act_copy_of c JOIN act_sections_supplement x ON x.act_id = c.central_id JOIN act_sections s ON s.act_id = c.copy_id AND upper(s.number) = upper(x.number)`).catch(() => []);
  replacedCache = { at: Date.now(), keys: new Set(rows.map((r) => r.k)) };
  return replacedCache.keys;
}

/** Keys of the sections whose text uses ANY of these words, best match first (a second opinion beside the search by meaning). */
async function keywordKeys(words: string[], limit: number): Promise<string[]> {
  const ws = words.filter((w) => /^[a-z]{3,}$/.test(w)).slice(0, 10); if (!ws.length) return [];
  const rows = await query<{ act_id: string; section_key: string }>(`SELECT s.act_id, s.section_key FROM act_sections s WHERE s.tsv @@ to_tsquery('english', $1) ORDER BY ts_rank_cd(s.tsv, to_tsquery('english', $1), 32) DESC LIMIT $2`, [ws.join(" | "), limit], 8000);
  return rows.map((r) => `${r.act_id}|${r.section_key}`);
}

async function semanticSearch(q: string, page: number, pageSize: number, filters: SearchFilters = {}): Promise<SearchOutcome> {
  const stores = vectorStores();
  // one query embedding per vector size in use (normally just one)
  const vectors = new Map<number, Promise<number[]>>();
  // everyday words get their statutory words added before the query is embedded and compared (src/config/search-synonyms.json)
  const { text: qx } = expandQuery(q, synonyms.rules), tokens = contentTokens(q), kwP = keywordKeys(contentWords(qx), 30).catch(() => [] as string[]);
  const vec = (dim: number) => (vectors.has(dim) ? vectors.get(dim)! : vectors.set(dim, embedQuery(qx, dim)).get(dim)!);
  const settled = await Promise.allSettled(stores.map(async (st) => st.nearest(await vec(st.dim), SEM_CHUNKS)));
  if (!settled.some((r) => r.status === "fulfilled")) throw (settled.find((r): r is PromiseRejectedResult => r.status === "rejected")?.reason ?? new Error("no vector store answered"));   // the real cause (Voyage 429, a database error ...), not a generic one
  const failed = settled.flatMap((r, i) => (r.status === "rejected" ? [stores[i].corpus] : []));
  if (failed.length) meaningPartial("acts", failed);   // some corpora answered and some did not: the results lack those Acts, so it is logged
  // sections whose text was replaced by a hand-filled one: their old vectors describe the wrong text, so only the supplement store's vectors count for them
  const replaced = await replacedKeys();
  const near = settled.flatMap((r, i) => (r.status === "fulfilled" ? r.value.filter((h) => stores[i].corpus === "supplement" || !replaced.has(`${h.actId}|${h.sectionKey}`)) : []))
    .sort((a, b) => a.distance - b.distance);
  const cands0 = distinctSections(near, SEM_POOL);
  const info = new Map((await query<{ actId: string; sectionKey: string; actStatus: string; status: string; central: boolean; title: string; number: string | null; state: string | null; heading: string | null; lead: string | null }>(
    `SELECT s.act_id AS "actId", s.section_key AS "sectionKey", a.act_status AS "actStatus", s.status, (a.category = 'central') AS central, a.title, s.number, a.state, s.heading, left(s.body, 700) AS lead
     FROM act_sections_v s JOIN acts a ON a.act_id = s.act_id JOIN unnest($1::text[], $2::text[]) AS k(a, sk) ON s.act_id = k.a AND s.section_key = k.sk`, [cands0.map((c) => c.actId), cands0.map((c) => c.sectionKey)]))
    .map((m) => [`${m.actId}|${m.sectionKey}`, m]));
  const cands = filters.jurisdiction || filters.status ? cands0.filter((c) => { const m = info.get(`${c.actId}|${c.sectionKey}`); return !!m && passes(filters, m); }) : cands0;   // the filters narrow the candidates before ranking
  // similarity x 0.9 for Acts not in force; Central Acts x1.3, or, when the question names a State, that State's Acts x1.2; garbled sections dropped;
  // the same section filed several times collapses into one result (the Central filing wins)
  const ranked = rankSections(cands, info, SEM_MAX, undefined, { states: statesIn(q), adjust: (_c: unknown, i: { heading?: string | null; lead?: string | null }) => lexicalBoost(tokens, i.heading, i.lead) }) as { actId: string; sectionKey: string; copies: number }[];   // a section about what was asked beats one that is only close in meaning
  const key = (x: { actId: string; sectionKey: string }) => `${x.actId}|${x.sectionKey}`, kw = await kwP;
  const byKey = new Map(ranked.map((x) => [key(x), x])), lifted = hybridOrder(ranked.map(key), kw).map((k) => byKey.get(k)!);   // keyword hits lift a result a few places, never overturn the order
  // current law first: when a repealed law and its replacement are both found, the replacement leads
  const withInfo = lifted.map((x) => ({ ...x, actTitle: info.get(key(x))?.title ?? "", actStatus: info.get(key(x))?.actStatus ?? "in_force" }));
  const list = currentLawFirst(withInfo, withInfo, replacedLaws.pairs, { k: withInfo.length, keyOf: key }) as { actId: string; sectionKey: string; copies: number }[];
  const slice = list.slice((page - 1) * pageSize, page * pageSize);
  const base = { available: true as const, total: list.length, totalCapped: false, page, pageSize, hasMore: page * pageSize < list.length, mode: "semantic" as const, note: SEMANTIC_NOTE, semantic: { used: true } };
  if (!slice.length) return { ...base, results: [], note: "No section is close in meaning. Try describing the situation in other words." };
  const rows = await query<Omit<SectionHit, "snippet" | "via"> & { body: string | null; snippet: string | null }>(
    `WITH k AS (SELECT * FROM unnest($1::text[], $2::text[]) WITH ORDINALITY AS t(act_id, section_key, n)),
          q AS (SELECT CASE WHEN $3 = '' THEN NULL ELSE websearch_to_tsquery('english', $3) END AS tq)
     SELECT ${COLS}, left(s.body, 400) AS body,
            CASE WHEN q.tq IS NULL THEN NULL ELSE ts_headline('english', left(s.body, 20000), q.tq, 'MaxFragments=2, MaxWords=26, MinWords=10, ShortWord=2, FragmentDelimiter=" … ", StartSel=${MARK_OPEN}, StopSel=${MARK_CLOSE}') END AS snippet
     FROM k JOIN act_sections_v s ON s.act_id = k.act_id AND s.section_key = k.section_key JOIN acts a ON a.act_id = s.act_id, q ORDER BY k.n`,
    [slice.map((c) => c.actId), slice.map((c) => c.sectionKey), highlightQuery(q)], 15000);
  const copies = new Map(slice.map((c) => [`${c.actId}|${c.sectionKey}`, c.copies]));
  // a snippet with highlighted words when the question's own words occur; otherwise the first readable words of the section
  const results = rows.map(({ body, snippet, ...r }): SectionHit => ({ ...r, snippet: snippet && snippet.includes(MARK_OPEN) ? tidy(snippet) : leadSnippet(body ?? ""), via: "semantic", copies: copies.get(`${r.actId}|${r.sectionKey}`) ?? 0 }));
  return { ...base, results };
}


/** Section lookups ("138 NI Act") and quoted phrases use keyword search. Everything else is searched by meaning when it is set up (VOYAGE_API_KEY and VECTOR_DATABASE_URL),
 *  and falls back to keyword search, with a short note, when it is not or when it fails. `exact` forces keyword search. */
async function searchMain(q: string, page = 1, pageSize = PAGE_SIZE, opts: { exact?: boolean; filters?: SearchFilters; surface?: Surface; loose?: boolean } = {}): Promise<SearchOutcome> {
  const filters = opts.filters ?? {};
  if (!dbConfigured()) return { available: false, reason: "not_configured", message: "Section search is not available yet." };
  try {
    const lookup = await lookupHits(q, page, pageSize, filters);
    if (lookup) return lookup;
  } catch {
    return { available: false, reason: "unreachable", message: "Section search could not be reached. Please try again in a moment." };
  }
  if (hasDevanagari(q) && hasSearchableChars(q)) return hindiSearch(q, page, pageSize);
  const chosen = chooseMode(q, { exact: !!opts.exact, hindi: hasDevanagari(q), semanticReady: semanticReady() });
  const surface = opts.surface ?? "acts";
  let sem: SemanticInfo = { used: false, ...(chosen.reason ? { reason: chosen.reason } : {}) };
  if (chosen.mode === "semantic" && hasSearchableChars(q)) {
    try { const r = await semanticSearch(q, page, pageSize, filters); meaningUsed(surface); return r; } catch (e) { sem = fellBackBecause(meaningFellBack(surface, e)); }
  } else if (chosen.reason === "semantic_unavailable") sem = fellBackBecause(meaningFellBack(surface, new Error("no voyage key")));   // asked for by default but not set up: counted, logged once
  const out = await textSearch(q, page, pageSize, filters, { loose: opts.loose });
  if (!out.available) return out;
  return { ...out, semantic: sem };   // the reader is told by the UI from `semantic` (noticeFor), not by a sentence glued to the note
}

/** Embeds several queries in one Voyage request ahead of searching them (see embedMany). Section lookups need no embedding and are skipped. */
export async function primeSemanticQueries(queries: string[]): Promise<void> {
  if (!semanticReady()) return;
  const need = queries.filter((q) => !parseSectionLookup(q) && hasSearchableChars(q) && !hasDevanagari(q));
  for (const dim of new Set(vectorStores().map((st) => st.dim))) await embedMany(need, dim);
}

/** A section named inside a longer query ("IPC 420 cheating punishment", "what does section 138 of the NI Act say") is an exact lookup: those hits come first on page 1, ahead of everything found by meaning. */
async function searchSectionsRaw(q: string, page = 1, pageSize = PAGE_SIZE, opts: { exact?: boolean; filters?: SearchFilters; surface?: Surface; loose?: boolean } = {}): Promise<SearchOutcome> {
  const out = await searchMain(q, page, pageSize, opts);
  if (!out.available || page !== 1 || out.mode === "lookup") return out;
  const named: SectionHit[] = [];
  for (const l of extractLookups(q).slice(0, 2)) { const r = await lookupHits(l, 1, 3, opts.filters ?? {}).catch(() => null); if (r && r.available) named.push(...r.results); }
  if (!named.length) return out;
  // a named section of a repealed law: its replacement is found from the old section's own heading ("Cheating and dishonestly inducing ...") and leads
  for (const h of [...named]) {
    const pair = h.actStatus !== "in_force" && h.heading ? pairFor(h.actTitle, replacedLaws.pairs) : null; if (!pair) continue;
    const r = await searchMain(h.heading!, 1, 15, { filters: opts.filters, surface: opts.surface }).catch(() => null);
    const next = r && r.available ? r.results.find((x) => x.actStatus === "in_force" && x.actTitle.toLowerCase().trim().startsWith(pair.new)) : null;
    if (next && !named.some((x) => x.actId === next.actId && x.sectionKey === next.sectionKey)) named.unshift(next);
  }
  const seen = new Set(named.map((h) => `${h.actId}|${h.sectionKey}`)), rest = out.results.filter((h) => !seen.has(`${h.actId}|${h.sectionKey}`));
  const merged = [...named, ...rest];
  return { ...out, results: (currentLawFirst(merged, merged, replacedLaws.pairs, { k: merged.length, keyOf: (h: SectionHit) => `${h.actId}|${h.sectionKey}` }) as SectionHit[]).slice(0, pageSize), total: out.total + named.length };   // the named section may be the repealed one: its replacement still leads
}

/** Titles leave this module display-ready (src/lib/docs/docType.mjs: capitals, acronyms, glued digits, fallbacks); the data keeps the raw ones. */
export const tidyTitles = (o: SearchOutcome): SearchOutcome => !o.available ? o : { ...o, results: dedupeCopies(o.results.map((h) => ({ ...h, actTitle: displayTitle(h.actTitle, h) }))), ...(o.missing ? { missing: { ...o.missing, actTitle: displayTitle(o.missing.actTitle, o.missing) } } : {}) };
export async function searchSections(q: string, page = 1, pageSize = PAGE_SIZE, opts: { exact?: boolean; filters?: SearchFilters; surface?: Surface; loose?: boolean } = {}): Promise<SearchOutcome> { return tidyTitles(await searchSectionsRaw(q, page, pageSize, opts)); }
