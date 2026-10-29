// Sections and Articles NUMBERED a given number, across the Acts, for Quick-find ("138", "43A", "138 NI", "NI 138"). Read-only, exact (no search by meaning, no Voyage). The ranking and what is "popular" live in
// src/lib/quickfind/rank.mjs and src/config/quickfind.json; this file only fetches the candidates. Server-only.
import cfgJson from "@/config/quickfind.json";
import { dbConfigured, query } from "./db";
import { displayTitle } from "@/lib/docs/docType.mjs";
import { parseQuick, rankNumbered, titlePrefixes, type QfConfig } from "@/lib/quickfind/rank.mjs";

const cfg = cfgJson as QfConfig;
export type NumberedHit = { actId: string; actTitle: string; category: string | null; actStatus: string | null; sectionKey: string; number: string; heading: string | null };
export type QuickLaws = { kind: "number" | "act-number" | "text"; number: string | null; hits: NumberedHit[] };
const COLS = `a.act_id AS "actId", a.title AS "actTitle", a.category, a.act_status AS "actStatus", s.section_key AS "sectionKey", s.number, s.heading`;
const FROM = `FROM acts a JOIN act_sections_v s ON s.act_id = a.act_id`;
// the Constitution's Articles are stored as A21; a bare "21" means Article 21 of the Constitution as well as section 21 of the Acts
const NUMBER = `(upper(s.number) = $1 OR (upper(s.number) = $2 AND lower(a.title) LIKE 'the constitution of india%' AND a.category = 'central'))`;

export async function numberedLaws(q: string, limit = 8): Promise<QuickLaws> {
  const p = parseQuick(q, cfg);
  if (p.kind === "text" || !dbConfigured()) return { kind: "text", number: null, hits: [] };
  const patterns = (p.kind === "act-number" ? titlePrefixes(p.acts, cfg) : cfg.acts.map((a) => a.title)).map((t) => `${t}%`), args = [p.number, `A${p.number}`];
  // the popular Central Acts first (a few rows), then, for a bare number only, other Acts to fill the list
  const popular = await query<NumberedHit>(`SELECT ${COLS} ${FROM} WHERE ${NUMBER} AND a.category = 'central' AND lower(a.title) LIKE ANY($3::text[]) LIMIT 60`, [...args, patterns]).catch(() => []);
  const others = p.kind === "act-number" ? [] : await query<NumberedHit>(
    `SELECT ${COLS} ${FROM} WHERE ${NUMBER} AND NOT (a.category = 'central' AND lower(a.title) LIKE ANY($3::text[])) ORDER BY (a.category = 'central') DESC, (a.act_status = 'in_force') DESC, length(a.title), s.ord LIMIT 30`, [...args, patterns]).catch(() => []);
  return { kind: p.kind, number: p.number, hits: rankNumbered([...popular, ...others], p.number, cfg).slice(0, limit).map((h) => ({ ...h, actTitle: displayTitle(h.actTitle, h) })) };
}
