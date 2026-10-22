// High Court search over the compact static index built by scripts/judgments/build-hc-search-index.mjs. Server-only.
// Searches the PARTY NAMES and CASE NUMBERS as recorded in the dataset; never judgment text. Words match whole (word boundary); a typed word with no exact match falls
// back to words that start with it. Results are newest first (ids run newest year first). Without the index (or without a data source) every call answers
// { indexAvailable: false } and no error: the UI then says High Court name search is not available.
import { ALL_COURTS } from "@/data/workspaceBrowse";
import { hcSourceKind, readDataJson, readHcPage } from "./hcData";
import { planQuery, shardOf } from "./hcSearchCore.mjs";
import type { CaseItem } from "./types";

type Meta = { version: number; shards: number; docs: number; courts: string[]; segments: [year: number, court: number, start: number, count: number][]; built: string; scope: string };
type Shard = Record<string, number[]>;
export type HcHit = CaseItem & { court: string; courtName: string; year: number; mainPage: number };
export type HcSearchResult = { indexAvailable: boolean; total: number; results: HcHit[]; built?: string; note?: string };

let metaCache: { at: number; meta: Meta | null } | null = null;
export async function hcSearchMeta(): Promise<Meta | null> {
  if (hcSourceKind() === null) return null;
  if (metaCache && Date.now() - metaCache.at < (metaCache.meta ? 600_000 : 10_000)) return metaCache.meta;   // a missing index is rechecked every 10 s, so building it while the server runs works
  const m = (await readDataJson("search/meta.json")) as Meta | null;
  metaCache = { at: Date.now(), meta: m && Array.isArray(m.segments) && m.docs > 0 ? m : null };
  return metaCache.meta;
}

const shards = new Map<number, Shard>();   // small LRU: a shard is about 1 MB, a few are larger
async function shard(n: number): Promise<Shard | null> {
  const hit = shards.get(n); if (hit) { shards.delete(n); shards.set(n, hit); return hit; }
  const s = (await readDataJson(`search/shard=${String(n).padStart(3, "0")}.json`, { noCache: true })) as Shard | null   // shards are up to 21 MB: bigger than the framework's 2 MB fetch cache, so they are kept in the instance's own LRU instead;
  if (s) { shards.set(n, s); if (shards.size > 24) shards.delete(shards.keys().next().value as number); }
  return s;
}
const decode = (d: number[]): number[] => { const out = new Array<number>(d.length); let a = 0; for (let i = 0; i < d.length; i++) out[i] = a += d[i]; return out; };

/** Posting list of a word (ascending ids): exact word, else the union of words starting with it. */
async function postings(term: string, allowPrefix: boolean): Promise<number[]> {
  const s = await shard(shardOf(term)); if (!s) return [];
  if (s[term]) return decode(s[term]);
  if (!allowPrefix || term.length < 3 || term.startsWith("#")) return [];
  const keys = Object.keys(s).filter((k) => k.startsWith(term)).slice(0, 300);
  if (!keys.length) return [];
  const all: number[] = []; for (const k of keys) all.push(...decode(s[k]));
  all.sort((a, b) => a - b); return all.filter((v, i) => i === 0 || v !== all[i - 1]);
}
const has = (a: number[], v: number): boolean => { let lo = 0, hi = a.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (a[m] === v) return true; a[m] < v ? (lo = m + 1) : (hi = m - 1); } return false; };

const pages = new Map<string, CaseItem[]>();
async function page(court: string, year: number, p: number): Promise<CaseItem[] | null> {
  const k = `${court}/${year}/${p}`, hit = pages.get(k); if (hit) return hit;
  const rows = await readHcPage(court, year, p); if (rows) { pages.set(k, rows); if (pages.size > 200) pages.delete(pages.keys().next().value as string); }
  return rows;
}

export async function searchHighCourts(opts: { q: string; court?: string; year?: number; page: number; pageSize: number }): Promise<HcSearchResult> {
  const meta = await hcSearchMeta();
  if (!meta) return { indexAvailable: false, total: 0, results: [], note: "The High Court search index is not available here." };
  const plan = planQuery(opts.q);
  if (!plan.keys.length && !plan.words.length) return { indexAvailable: true, total: 0, results: [], built: meta.built, note: "Type a name (two letters or more), a case number such as 933/2024, or a year such as 2024." };
  const ci = opts.court ? meta.courts.indexOf(opts.court) : -1;
  if (opts.court && ci < 0) return { indexAvailable: true, total: 0, results: [], built: meta.built };
  // id ranges that satisfy the court / year filter (segments are year-major, so one year is one run of ids per court)
  const ranges = meta.segments.filter(([y, c]) => (!opts.year || y === opts.year) && (ci < 0 || c === ci)).map(([, , start, count]) => [start, start + count] as const).sort((a, b) => a[0] - b[0]);
  if (!ranges.length) return { indexAvailable: true, total: 0, results: [], built: meta.built };
  const lists: number[][] = [];
  for (const k of plan.keys) lists.push(await postings(k, false));
  for (const w of plan.words) lists.push(await postings(w, true));
  if (lists.some((l) => !l.length)) return { indexAvailable: true, total: 0, results: [], built: meta.built };
  lists.sort((a, b) => a.length - b.length);
  const inRange = (id: number): boolean => { let lo = 0, hi = ranges.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (id < ranges[m][0]) hi = m - 1; else if (id >= ranges[m][1]) lo = m + 1; else return true; } return false; };
  const ids: number[] = [];
  for (const id of lists[0]) if (inRange(id) && lists.slice(1).every((l) => has(l, id))) ids.push(id);
  const start = (opts.page - 1) * opts.pageSize, slice = ids.slice(start, start + opts.pageSize), segs = meta.segments;
  const results: HcHit[] = [];
  for (const id of slice) {
    let lo = 0, hi = segs.length - 1;   // last segment whose start <= id
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (segs[m][2] <= id) lo = m; else hi = m - 1; }
    const [year, c, s0] = segs[lo], ord = id - s0, court = meta.courts[c], p = Math.floor(ord / 100) + 1, row = (await page(court, year, p))?.[ord % 100];
    if (row) results.push({ ...row, court, courtName: ALL_COURTS.find((x) => x.slug === court)?.name ?? court, year, mainPage: p });
  }
  return { indexAvailable: true, total: ids.length, results, built: meta.built };
}
