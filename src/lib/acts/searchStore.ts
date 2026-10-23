// Keyword search over Act section text in Neon (Postgres full-text search, 'english' config). LOGIC ONLY: no styling. The caller (route handler) validates input.
import { query, dbConfigured } from "./db";
import { actMatcher, hasDevanagari, hasSearchableChars, parseSectionLookup } from "./searchQuery.mjs";

export const MARK_OPEN = "", MARK_CLOSE = ""; // private-use markers around matched words in snippets; the UI turns them into highlights
export const PAGE_SIZE = 12, MAX_RESULTS = 1000;

export type SectionHit = {
  actId: string; actTitle: string; year: number | null; category: string; state: string | null; actStatus: string;
  sectionKey: string; number: string | null; heading: string | null; chapter: string | null; status: string; flags: string[];
  snippet: string; via: "text" | "lookup";
};
export type SearchOutcome =
  | { available: false; reason: "not_configured" | "unreachable"; message: string }
  | { available: true; results: SectionHit[]; total: number; totalCapped: boolean; page: number; pageSize: number; hasMore: boolean; mode: "text" | "lookup"; note: string };

/** First readable words of a section for a lookup result: skips markdown headings and all-capitals heading lines that lead some sections. */
const leadSnippet = (body: string) => body.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p && !/^#/.test(p) && !(p.length < 200 && p === p.toUpperCase())).join(" ").replace(/\*\*/g, "").replace(/\s+/g, " ").slice(0, 220);

const COLS = `s.act_id AS "actId", a.title AS "actTitle", a.year, a.category, a.state, a.act_status AS "actStatus", s.section_key AS "sectionKey", s.number, s.heading, s.chapter, s.status, s.flags`;

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
  if (!rows.length) return null;
  const all = rows.map(({ body, ...r }): SectionHit => ({ ...r, snippet: leadSnippet(body ?? ""), via: "lookup" }));
  const slice = all.slice((page - 1) * pageSize, page * pageSize);
  return { available: true, results: slice, total: all.length, totalCapped: false, page, pageSize, hasMore: page * pageSize < all.length, mode: "lookup", note: `Section lookup: section ${lk.number} of the Act matching "${lk.actPhrase}".` };
}

export async function searchSections(q: string, page = 1, pageSize = PAGE_SIZE): Promise<SearchOutcome> {
  if (!dbConfigured()) return { available: false, reason: "not_configured", message: "Section search is not available yet." };
  try {
    const lookup = await lookupHits(q, page, pageSize);
    if (lookup) return lookup;
    const empty = (note: string): SearchOutcome => ({ available: true, results: [], total: 0, totalCapped: false, page, pageSize, hasMore: false, mode: "text", note });
    if (!hasSearchableChars(q)) return empty("The search has no letters or numbers to look for.");
    const offset = (page - 1) * pageSize;
    if (offset >= MAX_RESULTS) return empty(`Only the first ${MAX_RESULTS} matches can be paged through. Narrow the search.`);
    const rows = await query<Omit<SectionHit, "via"> & { total: string | number }>(
      `WITH q AS (SELECT websearch_to_tsquery('english', $1) AS tq),
            m AS (SELECT s.act_id, s.section_key, ts_rank_cd(s.tsv, q.tq, 32) AS rank FROM act_sections s, q WHERE s.tsv @@ q.tq ORDER BY rank DESC, s.act_id, s.ord LIMIT ${MAX_RESULTS + 1}),
            p AS (SELECT *, (SELECT count(*) FROM m) AS total FROM m OFFSET $2 LIMIT $3)
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
