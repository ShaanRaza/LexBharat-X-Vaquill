// Keyword search over Act section text in Neon (Postgres full-text search, 'english' config). LOGIC ONLY: no styling. The caller (route handler) validates input.
import { query, dbConfigured } from "./db";
import { actMatcher, hasDevanagari, hasSearchableChars, parseSectionLookup } from "./searchQuery.mjs";
import { chooseMode, distinctSections, highlightQuery, rankSections } from "./semantic.mjs";
import { embedQuery, voyageConfigured } from "./embed";
import { nearestChunks, vectorConfigured } from "./vectorDb";

export const MARK_OPEN = "", MARK_CLOSE = ""; // private-use markers around matched words in snippets; the UI turns them into highlights
export const PAGE_SIZE = 12, MAX_RESULTS = 1000;
/** Re-ranking of the best 1,000 text matches for broad queries: a match whose whole query is in the heading counts 1.6x, a Central Act 1.3x, an Act no longer in force 0.75x. Exact section lookups never go through this. */
export const HEADING_BOOST = 1.6, CENTRAL_BOOST = 1.3, NOT_IN_FORCE_FACTOR = 0.75;
const RANK_BOOST = `(CASE WHEN to_tsvector('english', coalesce(s.heading, '')) @@ q.tq THEN ${HEADING_BOOST} ELSE 1 END) * (CASE WHEN a.category = 'central' THEN ${CENTRAL_BOOST} ELSE 1 END) * (CASE WHEN a.act_status = 'in_force' THEN 1 ELSE ${NOT_IN_FORCE_FACTOR} END)`;

export type SectionHit = {
  actId: string; actTitle: string; year: number | null; category: string; state: string | null; actStatus: string; sourceUrl: string | null;
  sectionKey: string; number: string | null; heading: string | null; chapter: string | null; status: string; flags: string[];
  snippet: string; via: "text" | "lookup" | "semantic";
};
export type SearchOutcome =
  | { available: false; reason: "not_configured" | "unreachable"; message: string }
  | { available: true; results: SectionHit[]; total: number; totalCapped: boolean; page: number; pageSize: number; hasMore: boolean; mode: "text" | "lookup" | "semantic"; note: string;
      /** How the query was searched: used=true for search by meaning; otherwise why keyword search ran instead (exact_requested, quoted_phrase, hindi, semantic_unavailable, semantic_error). */
      semantic?: { used: boolean; reason?: string };
      /** Set when the asked-for section number is confidently missing from our data (gaps.mjs): the UI shows the notice and the India Code link. */
      missing?: { actTitle: string; actId: string; number: string; sourceUrl: string | null } };

/** First readable words of a section for a lookup result: skips markdown headings and all-capitals heading lines that lead some sections. */
const leadSnippet = (body: string) => body.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p && !/^#/.test(p) && !(p.length < 200 && p === p.toUpperCase())).join(" ").replace(/\*\*/g, "").replace(/\s+/g, " ").slice(0, 220);

const COLS = `s.act_id AS "actId", a.title AS "actTitle", a.year, a.category, a.state, a.act_status AS "actStatus", a.source_url AS "sourceUrl", s.section_key AS "sectionKey", s.number, s.heading, s.chapter, s.status, s.flags`;

export const searchAvailable = () => dbConfigured();

async function lookupHits(q: string, page: number, pageSize: number): Promise<SearchOutcome | null> {
  const lk = parseSectionLookup(q);
  if (!lk) return null;
  const m = actMatcher(lk.actPhrase);
  const where = m.titlePrefix ? `lower(a.title) LIKE $1 || '%'` : m.words.map((_, i) => `a.title ILIKE '%' || $${i + 1} || '%'`).join(" AND ");
  const params: unknown[] = m.titlePrefix ? [m.titlePrefix] : m.words;
  if (!params.length) return null;
  const rows = await query<Omit<SectionHit, "snippet" | "via"> & { body: string | null }>(
    `SELECT ${COLS}, left(s.body, 400) AS body FROM acts a JOIN act_sections s ON s.act_id = a.act_id
     WHERE ${where} AND upper(s.number) = upper($${params.length + 1})
     ORDER BY (a.category = 'central') DESC, (a.act_status = 'in_force') DESC, length(a.title), s.ord LIMIT 24`, [...params, lk.number]);
  if (!rows.length) {
    const num = /^\d{1,4}$/.test(lk.number) ? Number(lk.number) : null;
    if (num === null) return null;
    const gone = await query<{ actId: string; actTitle: string; sourceUrl: string | null }>(
      `SELECT a.act_id AS "actId", a.title AS "actTitle", a.source_url AS "sourceUrl" FROM acts a JOIN act_missing_sections m ON m.act_id = a.act_id WHERE ${where} AND m.number = $${params.length + 1}
       ORDER BY (a.category = 'central') DESC, (a.act_status = 'in_force') DESC, length(a.title) LIMIT 1`, [...params, num]).catch(() => []);
    if (!gone.length) return null;
    return { available: true, results: [], total: 0, totalCapped: false, page, pageSize, hasMore: false, mode: "lookup", note: `Section ${lk.number} of ${gone[0].actTitle} is missing from our source data.`, missing: { ...gone[0], number: lk.number } };
  }
  const all = rows.map(({ body, ...r }): SectionHit => ({ ...r, snippet: leadSnippet(body ?? ""), via: "lookup" }));
  const slice = all.slice((page - 1) * pageSize, page * pageSize);
  return { available: true, results: slice, total: all.length, totalCapped: false, page, pageSize, hasMore: page * pageSize < all.length, mode: "lookup", note: `Section lookup: section ${lk.number} of the Act matching "${lk.actPhrase}".` };
}

async function textSearch(q: string, page: number, pageSize: number): Promise<SearchOutcome> {
  try {
    const empty = (note: string): SearchOutcome => ({ available: true, results: [], total: 0, totalCapped: false, page, pageSize, hasMore: false, mode: "text", note });
    if (!hasSearchableChars(q)) return empty("The search has no letters or numbers to look for.");
    const offset = (page - 1) * pageSize;
    if (offset >= MAX_RESULTS) return empty(`Only the first ${MAX_RESULTS} matches can be paged through. Narrow the search.`);
    const rows = await query<Omit<SectionHit, "via"> & { total: string | number }>(
      `WITH q AS (SELECT websearch_to_tsquery('english', $1) AS tq),
            c AS MATERIALIZED (SELECT s.act_id, s.section_key, ts_rank_cd(s.tsv, q.tq, 32) AS base FROM act_sections s, q WHERE s.tsv @@ q.tq ORDER BY base DESC, s.act_id, s.ord LIMIT ${MAX_RESULTS + 1}),
            m AS MATERIALIZED (SELECT c.act_id, c.section_key, c.base * ${RANK_BOOST} AS rank FROM c JOIN act_sections s USING (act_id, section_key) JOIN acts a ON a.act_id = s.act_id, q),
            p AS (SELECT *, (SELECT count(*) FROM m) AS total FROM m ORDER BY rank DESC, act_id, section_key OFFSET $2 LIMIT $3)
       SELECT ${COLS}, p.total,
              ts_headline('english', left(s.body, 20000), q.tq, 'MaxFragments=2, MaxWords=26, MinWords=10, ShortWord=2, FragmentDelimiter=" … ", StartSel=${MARK_OPEN}, StopSel=${MARK_CLOSE}') AS snippet
       FROM p JOIN act_sections s USING (act_id, section_key) JOIN acts a ON a.act_id = s.act_id, q ORDER BY p.rank DESC, s.act_id, s.ord`, [q, offset, pageSize], 15000);
    const total = rows.length ? Number(rows[0].total) : 0, capped = total > MAX_RESULTS;
    const results = rows.map(({ total: _t, ...r }): SectionHit => ({ ...r, snippet: r.snippet ?? "", via: "text" }));
    if (!rows.length && page === 1) {
      // distinguish "nothing matches" from "a Hindi word, which is not searchable yet"
      return empty(hasDevanagari(q) ? "Hindi text is not searchable yet: section text is searched in English only." : "No section matches. Try fewer or different words, or put an exact phrase in quotes.");
    }
    return { available: true, results, total: Math.min(total, MAX_RESULTS), totalCapped: capped, page, pageSize, hasMore: offset + results.length < Math.min(total, MAX_RESULTS), mode: "text", note: 'Searches the text of Central and State Acts (English). Words are matched by stem ("dishonoured" finds "dishonour"); put a phrase in quotes for an exact phrase.' };
  } catch (e) {
    return { available: false, reason: "unreachable", message: "Section search could not be reached. Please try again in a moment." };
  }
}

// ---- search by meaning (Central Acts). Query -> voyage-4 (256-d) -> nearest chunks in the vector database -> distinct sections -> metadata and snippets from the section database.
export const SEM_CHUNKS = 150, SEM_MAX = 60;
export const semanticReady = () => voyageConfigured() && vectorConfigured();
const SEMANTIC_NOTE = 'Ranked by meaning, over Central Acts. For State Acts, exact words or a "quoted phrase", use "Search exact words".';

async function semanticSearch(q: string, page: number, pageSize: number): Promise<SearchOutcome> {
  const near = await nearestChunks(await embedQuery(q), SEM_CHUNKS);
  const cands = distinctSections(near, SEM_CHUNKS);
  const info = new Map((await query<{ actId: string; sectionKey: string; actStatus: string; status: string }>(
    `SELECT s.act_id AS "actId", s.section_key AS "sectionKey", a.act_status AS "actStatus", s.status FROM act_sections s JOIN acts a ON a.act_id = s.act_id
     JOIN unnest($1::text[], $2::text[]) AS k(a, sk) ON s.act_id = k.a AND s.section_key = k.sk`, [cands.map((c) => c.actId), cands.map((c) => c.sectionKey)]))
    .map((m) => [`${m.actId}|${m.sectionKey}`, m]));
  const list = rankSections(cands, info, SEM_MAX); // similarity x 0.9 for Acts not in force; garbled sections dropped
  const slice = list.slice((page - 1) * pageSize, page * pageSize);
  const base = { available: true as const, total: list.length, totalCapped: false, page, pageSize, hasMore: page * pageSize < list.length, mode: "semantic" as const, note: SEMANTIC_NOTE, semantic: { used: true } };
  if (!slice.length) return { ...base, results: [], note: "No section is close in meaning. Try describing the situation in other words." };
  const rows = await query<Omit<SectionHit, "snippet" | "via"> & { body: string | null; snippet: string | null }>(
    `WITH k AS (SELECT * FROM unnest($1::text[], $2::text[]) WITH ORDINALITY AS t(act_id, section_key, n)),
          q AS (SELECT CASE WHEN $3 = '' THEN NULL ELSE websearch_to_tsquery('english', $3) END AS tq)
     SELECT ${COLS}, left(s.body, 400) AS body,
            CASE WHEN q.tq IS NULL THEN NULL ELSE ts_headline('english', left(s.body, 20000), q.tq, 'MaxFragments=2, MaxWords=26, MinWords=10, ShortWord=2, FragmentDelimiter=" … ", StartSel=${MARK_OPEN}, StopSel=${MARK_CLOSE}') END AS snippet
     FROM k JOIN act_sections s ON s.act_id = k.act_id AND s.section_key = k.section_key JOIN acts a ON a.act_id = s.act_id, q ORDER BY k.n`,
    [slice.map((c) => c.actId), slice.map((c) => c.sectionKey), highlightQuery(q)], 15000);
  // a snippet with highlighted words when the question's own words occur; otherwise the first readable words of the section
  const results = rows.map(({ body, snippet, ...r }): SectionHit => ({ ...r, snippet: snippet && snippet.includes(MARK_OPEN) ? snippet : leadSnippet(body ?? ""), via: "semantic" }));
  return { ...base, results };
}

const FALLBACK_NOTE: Record<string, string> = {
  semantic_unavailable: "Search by meaning is not set up here, so this is a keyword search.",
  semantic_error: "Search by meaning is not responding right now, so this is a keyword search.",
};

/** Section lookups ("138 NI Act") and quoted phrases use keyword search. Everything else is searched by meaning when it is set up (VOYAGE_API_KEY and VECTOR_DATABASE_URL),
 *  and falls back to keyword search, with a short note, when it is not or when it fails. `exact` forces keyword search. */
export async function searchSections(q: string, page = 1, pageSize = PAGE_SIZE, opts: { exact?: boolean } = {}): Promise<SearchOutcome> {
  if (!dbConfigured()) return { available: false, reason: "not_configured", message: "Section search is not available yet." };
  try {
    const lookup = await lookupHits(q, page, pageSize);
    if (lookup) return lookup;
  } catch {
    return { available: false, reason: "unreachable", message: "Section search could not be reached. Please try again in a moment." };
  }
  const chosen = chooseMode(q, { exact: !!opts.exact, hindi: hasDevanagari(q), semanticReady: semanticReady() });
  let reason: string | null = chosen.reason;
  if (chosen.mode === "semantic" && hasSearchableChars(q)) {
    try { return await semanticSearch(q, page, pageSize); } catch { reason = "semantic_error"; }
  }
  const out = await textSearch(q, page, pageSize);
  if (!out.available) return out;
  const note = reason && FALLBACK_NOTE[reason] ? `${FALLBACK_NOTE[reason]} ${out.note}` : out.note;
  return { ...out, note, semantic: { used: false, ...(reason ? { reason } : {}) } };
}
