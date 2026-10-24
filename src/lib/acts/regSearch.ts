// Keyword search over regulator instrument text (RBI, SEBI, MCA ... Law Commission, tribunal-filed) in reg_sections. LOGIC ONLY: no styling.
// Same 'english' full-text config and weighting as the Acts search. The index is on the expression below, so every query must use exactly this expression.
import { hasSearchableChars } from "./searchQuery.mjs";
import { regConfigured, regQuery } from "./regDb";
import { MARK_CLOSE, MARK_OPEN, MAX_RESULTS, type SearchOutcome, type SectionHit } from "./searchStore";

export const REG_TSV = `(setweight(to_tsvector('english', coalesce(s.heading, '')), 'A') || setweight(to_tsvector('english', left(coalesce(s.body, ''), 600000)), 'B'))`;
export const regAvailable = () => regConfigured();
const NOTE = "Searches the text of regulator instruments (RBI, SEBI, MCA, DGFT, TRAI, IRDAI and others), Law Commission reports and tribunal-filed instruments, in English. Words are matched by stem; put a phrase in quotes for an exact phrase.";

export async function searchRegulators(q: string, page: number, pageSize: number): Promise<SearchOutcome> {
  if (!regConfigured()) return { available: false, reason: "not_configured", message: "Regulator text search is not available yet." };
  const empty = (note: string): SearchOutcome => ({ available: true, results: [], total: 0, totalCapped: false, page, pageSize, hasMore: false, mode: "text", note });
  if (!hasSearchableChars(q)) return empty("The search has no letters or numbers to look for.");
  const offset = (page - 1) * pageSize;
  if (offset >= MAX_RESULTS) return empty(`Only the first ${MAX_RESULTS} matches can be paged through. Narrow the search.`);
  try {
    const rows = await regQuery<Omit<SectionHit, "via"> & { total: string | number }>(
      `WITH q AS (SELECT websearch_to_tsquery('english', $1) AS tq),
            m AS MATERIALIZED (SELECT s.act_id, s.section_key, ts_rank_cd(${REG_TSV}, q.tq, 32) * (CASE WHEN a.act_status = 'in_force' THEN 1 ELSE 0.75 END) AS rank
                               FROM reg_sections s JOIN reg_acts a ON a.act_id = s.act_id, q WHERE ${REG_TSV} @@ q.tq ORDER BY ts_rank_cd(${REG_TSV}, q.tq, 32) DESC LIMIT ${MAX_RESULTS + 1}),
            p AS (SELECT *, (SELECT count(*) FROM m) AS total FROM m ORDER BY rank DESC, act_id, section_key OFFSET $2 LIMIT $3)
       SELECT s.act_id AS "actId", a.title AS "actTitle", a.year, 'regulatory' AS category, NULL::text AS state, a.department, a.act_status AS "actStatus", a.source_url AS "sourceUrl",
              s.section_key AS "sectionKey", s.number, s.heading, s.chapter, s.status, s.flags, p.total,
              ts_headline('english', left(s.body, 20000), q.tq, 'MaxFragments=2, MaxWords=26, MinWords=10, ShortWord=2, FragmentDelimiter=" … ", StartSel=${MARK_OPEN}, StopSel=${MARK_CLOSE}') AS snippet
       FROM p JOIN reg_sections s USING (act_id, section_key) JOIN reg_acts a ON a.act_id = s.act_id, q ORDER BY p.rank DESC, s.act_id, s.ord`, [q, offset, pageSize], 15000);
    const total = rows.length ? Number(rows[0].total) : 0, capped = total > MAX_RESULTS;
    const results = rows.map(({ total: _t, ...r }): SectionHit => ({ ...r, snippet: r.snippet ?? "", via: "text" }));
    if (!rows.length && page === 1) return empty("No regulator section matches. Try fewer or different words, or put an exact phrase in quotes.");
    return { available: true, results, total: Math.min(total, MAX_RESULTS), totalCapped: capped, page, pageSize, hasMore: offset + results.length < Math.min(total, MAX_RESULTS), mode: "text", note: NOTE };
  } catch {
    return { available: false, reason: "unreachable", message: "Regulator text search could not be reached. Please try again in a moment." };
  }
}
