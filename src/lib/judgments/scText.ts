// Supreme Court judgment TEXT (English) from the free Neon projects: sc_cases (one gzip blob of ordered chunks per case, SC_DATABASE_URL), sc_kw (stripped word index per case, SC_KEYWORD_DATABASE_URL)
// and sc_emb_256 (vectors, VECTOR_DATABASE_URL_SC). Server-only. LOGIC ONLY. Connection strings are read here and never logged.
import { neon } from "@neondatabase/serverless";
import { gunzipSync } from "node:zlib";
import { embedQuery, voyageConfigured } from "@/lib/acts/embed";
import { scVectorStore } from "@/lib/acts/vectorStore";
import { distinctSections } from "@/lib/acts/semantic.mjs";
import { phraseIn, snippetAround, termCounts } from "./scTextSearch.mjs";

export type ScChunk = { i: number; cs: number; ps: number | null; t: string };
type Sql = ReturnType<typeof neon>;
const clients = new Map<string, Sql>();
const sqlFor = (name: string): Sql | null => { const u = process.env[name]?.trim(); if (!u) return null; let c = clients.get(name); if (!c) clients.set(name, (c = neon(u))); return c; };
export const scTextConfigured = () => !!process.env.SC_DATABASE_URL?.trim();
export const scKeywordConfigured = () => !!process.env.SC_KEYWORD_DATABASE_URL?.trim() && scTextConfigured();
export const scSemanticConfigured = () => voyageConfigured() && !!scVectorStore() && scTextConfigured();

async function run<T>(name: string, text: string, params: unknown[] = [], timeoutMs = 10000): Promise<T[]> {
  const sql = sqlFor(name); if (!sql) throw new Error("not configured");
  const res = await sql.transaction((tx) => [tx.query(`SET LOCAL statement_timeout = ${Math.floor(timeoutMs)}`), tx.query(text, params)]);
  return res[1] as T[];
}
const toBuffer = (v: unknown): Buffer => (typeof v === "string" ? Buffer.from(v.startsWith("\\x") ? v.slice(2) : v, "hex") : Buffer.from(v as Uint8Array));
const unpack = (blob: unknown): ScChunk[] => JSON.parse(gunzipSync(toBuffer(blob)).toString("utf8")) as ScChunk[];

/** All English chunks of one case in reading order, or null (no text held / not configured / unreachable). */
export async function getCaseText(caseId: string): Promise<{ chunks: ScChunk[]; mixed: boolean } | null> {
  if (!scTextConfigured() || !/^\d{4}_INSC_\d+$/.test(caseId)) return null;
  try {
    const rows = await run<{ blob: unknown; mixed: boolean }>("SC_DATABASE_URL", `SELECT blob, mixed FROM sc_cases WHERE case_id = $1`, [caseId]);
    return rows.length ? { chunks: unpack(rows[0].blob), mixed: rows[0].mixed } : null;
  } catch { return null; }
}
async function blobsFor(ids: string[]): Promise<Map<string, ScChunk[]>> {
  const rows = ids.length ? await run<{ case_id: string; blob: unknown }>("SC_DATABASE_URL", `SELECT case_id, blob FROM sc_cases WHERE case_id = ANY($1::text[])`, [ids], 15000) : [];
  return new Map(rows.map((r) => [r.case_id, unpack(r.blob)]));
}

export type ScPassage = { caseId: string; chunk: number; page: number | null; text: string; score: number };
const PASSAGE_CHARS = 1500;

/** Search by meaning: query -> voyage-4 (256-d) -> nearest chunks -> best chunk of each case (at most `limit` cases), with the chunk's text. */
export async function searchJudgmentsByMeaning(q: string, limit = 20): Promise<ScPassage[]> {
  const store = scVectorStore();
  if (!store || !scSemanticConfigured()) throw new Error("not configured");
  const near = await store.nearest(await embedQuery(q, store.dim), 150);
  const cands = distinctSections(near.map((h) => ({ actId: h.actId, sectionKey: h.sectionKey, distance: h.distance })), limit * 3);
  const best = new Map<string, { chunk: number; distance: number }>();
  for (const c of cands) if (!best.has(c.actId)) best.set(c.actId, { chunk: parseInt(c.sectionKey, 10), distance: c.distance });
  const ids = [...best.keys()].slice(0, limit), blobs = await blobsFor(ids);
  return ids.flatMap((id) => {
    const ch = blobs.get(id)?.find((c) => c.i === best.get(id)!.chunk);
    return ch ? [{ caseId: id, chunk: ch.i, page: ch.ps ?? null, text: ch.t.slice(0, PASSAGE_CHARS), score: 1 - best.get(id)!.distance }] : [];
  });
}

/** Keyword search inside judgments. Candidates come from the stripped word index (every word of the query, stems); quoted phrases are verified in the text itself; the best `limit` are ranked by how often the words occur
 *  (per 10,000 characters) and given a snippet. When more than 150 judgments match, only the 150 best by the index are ranked (the result says so). */
export async function searchJudgmentsByWords(q: string, limit = 60): Promise<{ total: number; ranked: number; hits: (ScPassage & { count: number })[] }> {
  if (!scKeywordConfigured()) throw new Error("not configured");
  const phrases = [...q.matchAll(/["“]([^"”]{2,120})["”]/g)].map((m) => m[1]);
  const cap = 150;
  const cand = await run<{ case_id: string; n: string | number }>("SC_KEYWORD_DATABASE_URL",
    `WITH q AS (SELECT websearch_to_tsquery('english', $1) AS tq), m AS (SELECT k.case_id, ts_rank(k.tsv, q.tq) AS r FROM sc_kw k, q WHERE k.tsv @@ q.tq)
     SELECT case_id, (SELECT count(*) FROM m) AS n FROM m ORDER BY r DESC, case_id DESC LIMIT ${cap}`, [q.replace(/["“”]/g, " ")], 20000);   // the index has no word positions, so a quoted phrase is first searched as its words and then verified in the text
  const total = cand.length ? Number(cand[0].n) : 0;
  const blobs = await blobsFor(cand.map((c) => c.case_id));
  const words = [...new Set(q.replace(/["“”]/g, " ").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2))];
  const hits: (ScPassage & { count: number })[] = [];
  for (const c of cand) {
    const chunks = blobs.get(c.case_id); if (!chunks) continue;
    const full = chunks.map((x) => x.t).join("\n\n");
    if (phrases.length && !phrases.every((p) => phraseIn(full, p))) continue;
    const { count, perTenK } = termCounts(full, phrases.length ? phrases : words);
    const at = snippetAround(chunks, phrases.length ? phrases : words);
    hits.push({ caseId: c.case_id, chunk: at.chunk, page: at.page, text: at.text, score: perTenK, count });
  }
  hits.sort((a, b) => b.score - a.score);
  return { total: phrases.length ? hits.length : total, ranked: Math.min(cand.length, cap), hits: hits.slice(0, limit) };
}
