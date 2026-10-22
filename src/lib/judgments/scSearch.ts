// Cross-year Supreme Court search over a static, pre-built index (src/data/judgments/sc-index.generated.ts, built by scripts/judgments/build-sc-index.py).
// It matches WORDS IN THE CASE TITLE (which carries both parties), THE CITATION AND THE CASE NUMBER read from the judgment heading. It is not full-text search of
// judgments and has no relevance model: results whose text contains the whole phrase come first, then results containing every word; each group is newest first.
// No search service, database or dependency: the index is a ~6 MB JSON string loaded once per server instance.
import { SC_INDEX_JSON } from "@/data/judgments/sc-index.generated";
import { hayOf, matchesWords, queryWords } from "./scMatch";

export type ScHit = { caseId: string; year: number; title: string; citation?: string; decisionDate?: string; disposition?: string; caseNumber?: string };

type Row = ScHit & { hay: string };
let ROWS: Row[] | null = null;
function rows(): Row[] {
  if (!ROWS) ROWS = (JSON.parse(SC_INDEX_JSON).rows as (string | number)[][]).map(([caseId, year, title, citation, decisionDate, disposition, caseNumber]) => ({
    caseId: caseId as string, year: year as number, title: title as string, ...(citation ? { citation: citation as string } : {}), ...(decisionDate ? { decisionDate: decisionDate as string } : {}),
    ...(disposition ? { disposition: disposition as string } : {}), ...(caseNumber ? { caseNumber: caseNumber as string } : {}),
    hay: hayOf(title as string, citation as string, caseNumber as string),
  }));
  return ROWS;
}

export function searchSupremeCourt(query: string, page: number, pageSize: number): { results: ScHit[]; total: number } {
  const tokens = queryWords(query);
  if (!tokens.length) return { results: [], total: 0 };
  const phrase: Row[] = [], all: Row[] = [];
  for (const r of rows()) {
    if (!matchesWords(r.hay, tokens)) continue;
    (r.hay.includes(` ${tokens.join(" ")}`) ? phrase : all).push(r);
  }
  const hits = [...phrase, ...all], start = (page - 1) * pageSize;
  return { results: hits.slice(start, start + pageSize).map(({ hay: _h, ...h }) => h), total: hits.length };
}
