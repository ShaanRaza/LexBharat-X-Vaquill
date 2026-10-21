// Cross-year Supreme Court search over a static, pre-built index (src/data/judgments/sc-index.generated.ts, built by scripts/judgments/build-sc-index.py).
// It matches WORDS IN THE CASE TITLE (which carries both parties) AND THE CITATION. It is not full-text search of judgments and has no relevance model:
// results whose title or citation contains the whole phrase come first, then results containing every word; each group is newest first.
// No search service, database or dependency: the index is a 5 MB JSON file loaded once per server instance.
import { SC_INDEX_JSON } from "@/data/judgments/sc-index.generated";

export type ScHit = { caseId: string; year: number; title: string; citation?: string; decisionDate?: string; disposition?: string };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

type Row = ScHit & { hay: string };
let ROWS: Row[] | null = null;
function rows(): Row[] {
  if (!ROWS) ROWS = (JSON.parse(SC_INDEX_JSON).rows as (string | number)[][]).map(([caseId, year, title, citation, decisionDate, disposition]) => ({
    caseId: caseId as string, year: year as number, title: title as string, ...(citation ? { citation: citation as string } : {}), ...(decisionDate ? { decisionDate: decisionDate as string } : {}), ...(disposition ? { disposition: disposition as string } : {}),
    hay: ` ${norm(`${title} ${citation}`)} `,
  }));
  return ROWS;
}

export function searchSupremeCourt(query: string, page: number, pageSize: number): { results: ScHit[]; total: number } {
  const q = norm(query), all_ = q.split(" ").filter(Boolean);
  if (!q) return { results: [], total: 0 };
  // "v", "vs" and "versus" only join the parties; they are ignored unless they are all the user typed. Words match at the start of a word ("sharm" finds Sharma).
  const words = all_.filter((t) => !["v", "vs", "versus"].includes(t)), tokens = words.length ? words : all_;
  const phrase: Row[] = [], all: Row[] = [];
  for (const r of rows()) {
    if (!tokens.every((t) => r.hay.includes(` ${t}`))) continue;
    (r.hay.includes(` ${tokens.join(" ")}`) ? phrase : all).push(r);
  }
  const hits = [...phrase, ...all], start = (page - 1) * pageSize;
  return { results: hits.slice(start, start + pageSize).map(({ hay: _h, ...h }) => h), total: hits.length };
}
