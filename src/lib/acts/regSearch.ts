// Keyword search over regulator instrument text (RBI, SEBI, MCA ... Law Commission, tribunal-filed) in reg_sections. LOGIC ONLY: no styling.
// Same 'english' full-text config and weighting as the Acts search. The index is on the expression below, so every query must use exactly this expression.
import { cleanPlain } from "@/lib/text/clean.mjs";
import { tidyTitles } from "./searchStore";
import { hasDevanagari, hasSearchableChars } from "./searchQuery.mjs";
import { chooseMode, distinctSections, highlightQuery, rankSections } from "./semantic.mjs";
import { embedQuery, voyageConfigured } from "./embed";
import { regulatoryStore } from "./vectorStore";
import { regConfigured, regQuery } from "./regDb";
import { fellBackBecause, type SemanticInfo } from "./meaning.mjs";
import { meaningFellBack, meaningUsed } from "./meaningLog";
import { MARK_CLOSE, MARK_OPEN, MAX_RESULTS, type SearchOutcome, type SectionHit } from "./searchStore";

export const REG_TSV = `(setweight(to_tsvector('english', coalesce(s.heading, '')), 'A') || setweight(to_tsvector('english', left(coalesce(s.body, ''), 600000)), 'B'))`;
export const regAvailable = () => regConfigured();
const NOTE = "Searches the text of regulator instruments (RBI, SEBI, MCA, DGFT, TRAI, IRDAI and others), Law Commission reports and tribunal-filed instruments, in English. Words are matched by stem; put a phrase in quotes for an exact phrase.";

async function textRegulators(q: string, page: number, pageSize: number): Promise<SearchOutcome> {
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
    const results = rows.map(({ total: _t, ...r }): SectionHit => ({ ...r, snippet: cleanPlain(r.snippet ?? ""), via: "text" }));
    if (!rows.length && page === 1) return empty("No regulator section matches. Try fewer or different words, or put an exact phrase in quotes.");
    return { available: true, results, total: Math.min(total, MAX_RESULTS), totalCapped: capped, page, pageSize, hasMore: offset + results.length < Math.min(total, MAX_RESULTS), mode: "text", note: NOTE };
  } catch {
    return { available: false, reason: "unreachable", message: "Regulator text search could not be reached. Please try again in a moment." };
  }
}

// ---- search by meaning over regulator instruments: query -> voyage-4 -> nearest chunks in regulatory_emb_256 -> distinct sections -> text and snippets from reg_sections.
const SEM_CHUNKS = 200, SEM_POOL = 300, SEM_MAX = 60;
export const regSemanticReady = () => voyageConfigured() && !!regulatoryStore() && regConfigured();
const SEM_NOTE = 'Ranked by meaning, over regulator instruments. For exact words use a "quoted phrase" or "Search exact words".';

async function semanticRegulators(q: string, page: number, pageSize: number): Promise<SearchOutcome> {
  const store = regulatoryStore();
  if (!store) throw new Error("no regulator vector store");
  const near = await store.nearest(await embedQuery(q, store.dim), SEM_CHUNKS);
  const cands = distinctSections(near, SEM_POOL);
  const info = new Map((await regQuery<{ actId: string; sectionKey: string; actStatus: string; status: string; title: string; number: string | null }>(
    `SELECT s.act_id AS "actId", s.section_key AS "sectionKey", a.act_status AS "actStatus", s.status, a.title, s.number
     FROM reg_sections s JOIN reg_acts a ON a.act_id = s.act_id JOIN unnest($1::text[], $2::text[]) AS k(a, sk) ON s.act_id = k.a AND s.section_key = k.sk`, [cands.map((c) => c.actId), cands.map((c) => c.sectionKey)]))
    .map((m) => [`${m.actId}|${m.sectionKey}`, { ...m, central: false, state: null }]));
  const list = rankSections(cands, info, SEM_MAX, undefined, { central: 1 }) as { actId: string; sectionKey: string }[];
  const slice = list.slice((page - 1) * pageSize, page * pageSize);
  const base = { available: true as const, total: list.length, totalCapped: false, page, pageSize, hasMore: page * pageSize < list.length, mode: "semantic" as const, note: SEM_NOTE, semantic: { used: true } };
  if (!slice.length) return { ...base, results: [], note: "No regulator section is close in meaning. Try describing the situation in other words." };
  const rows = await regQuery<Omit<SectionHit, "snippet" | "via"> & { body: string | null; snippet: string | null }>(
    `WITH k AS (SELECT * FROM unnest($1::text[], $2::text[]) WITH ORDINALITY AS t(act_id, section_key, n)),
          q AS (SELECT CASE WHEN $3 = '' THEN NULL ELSE websearch_to_tsquery('english', $3) END AS tq)
     SELECT s.act_id AS "actId", a.title AS "actTitle", a.year, 'regulatory' AS category, NULL::text AS state, a.department, a.act_status AS "actStatus", a.source_url AS "sourceUrl",
            s.section_key AS "sectionKey", s.number, s.heading, s.chapter, s.status, s.flags, left(s.body, 400) AS body,
            CASE WHEN q.tq IS NULL THEN NULL ELSE ts_headline('english', left(s.body, 20000), q.tq, 'MaxFragments=2, MaxWords=26, MinWords=10, ShortWord=2, FragmentDelimiter=" … ", StartSel=${MARK_OPEN}, StopSel=${MARK_CLOSE}') END AS snippet
     FROM k JOIN reg_sections s ON s.act_id = k.act_id AND s.section_key = k.section_key JOIN reg_acts a ON a.act_id = s.act_id, q ORDER BY k.n`,
    [slice.map((c) => c.actId), slice.map((c) => c.sectionKey), highlightQuery(q)], 15000);
  const lead = (b: string) => b.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p && !/^#/.test(p)).join(" ").replace(/\*\*/g, "").replace(/\s+/g, " ").slice(0, 220);
  const results = rows.map(({ body, snippet, ...r }): SectionHit => ({ ...r, snippet: snippet && snippet.includes(MARK_OPEN) ? cleanPlain(snippet) : cleanPlain(lead(body ?? "")), via: "semantic" }));
  return { ...base, results };
}

/** Regulator search: by meaning when it is set up (VOYAGE_API_KEY + the regulator vector store), otherwise, or for "quoted phrases" / exact=true, by keyword. */
async function searchRegulatorsRaw(q: string, page: number, pageSize: number, opts: { exact?: boolean } = {}): Promise<SearchOutcome> {
  if (!regConfigured()) return { available: false, reason: "not_configured", message: "Regulator text search is not available yet." };
  const chosen = chooseMode(q, { exact: !!opts.exact, hindi: hasDevanagari(q), semanticReady: regSemanticReady() });
  let sem: SemanticInfo = { used: false, ...(chosen.reason ? { reason: chosen.reason } : {}) };
  if (chosen.mode === "semantic" && hasSearchableChars(q)) {
    try { const r = await semanticRegulators(q, page, pageSize); meaningUsed("regulators"); return r; } catch (e) { sem = fellBackBecause(meaningFellBack("regulators", e)); }   // keyword search answers, and the reader is told
  } else if (chosen.reason === "semantic_unavailable") sem = fellBackBecause(meaningFellBack("regulators", new Error("no voyage key")));
  const out = await textRegulators(q, page, pageSize);
  return out.available ? { ...out, semantic: sem } : out;
}

export async function searchRegulators(q: string, page: number, pageSize: number, opts: { exact?: boolean } = {}): Promise<SearchOutcome> { return tidyTitles(await searchRegulatorsRaw(q, page, pageSize, opts)); }
