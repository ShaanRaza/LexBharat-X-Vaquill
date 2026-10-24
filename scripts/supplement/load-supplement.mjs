#!/usr/bin/env node
// Loads the sections you filled in under content/supplement/ (one text file per section). Run it whenever you add or change a file:   npm run load:supplement
// What it does: reads every .txt file; files with an empty text area are "pending" and skipped; checks each filled file; adds or updates the supplement row (separate table, never the
// open-india-law rows); embeds the section with voyage-4 at 256 dimensions (normal API, one request every 21 seconds for the free account) into supplement_emb_256 in the vector
// database; removes rows whose file was emptied or deleted. Unchanged files are skipped. `--dry-run` only checks the files. Reads .env.local; never prints a key or connection string.
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { chunkPages } from "../../src/lib/vault/chunk.mjs";
import { entryHash, parseSupplementFile } from "../../src/lib/supplement/parse.mjs";
import { unitLabel, unitOrd } from "../../src/lib/acts/unitLabel.mjs";

for (const l of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const DIR = "content/supplement", DRY = process.argv.includes("--dry-run"), MAIN_LIMIT_MB = 900, GAP_MS = 21000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (s = "") => console.log(s);

// ---- 1. read and check the files
// the section files are in DIR itself; the Orders, Rules and Articles of the Schedules are in DIR/schedules/
const files = [...fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".txt")).sort(), ...(fs.existsSync(path.join(DIR, "schedules")) ? fs.readdirSync(path.join(DIR, "schedules")).filter((f) => f.toLowerCase().endsWith(".txt")).sort().map((f) => `schedules/${f}`) : [])];
const parsed = files.map((f) => ({ f, ...parseSupplementFile(fs.readFileSync(path.join(DIR, f), "utf8"), f) }));
const ok = parsed.filter((p) => p.status === "ok"), pending = parsed.filter((p) => p.status === "pending"), bad = parsed.filter((p) => p.status === "error");
const seen = new Map();
for (const p of ok) { const k = `${p.entry.actId}|${p.entry.number}`; if (seen.has(k)) { p.status = "error"; p.errors = [`Same Act and section as ${seen.get(k)}.`]; } else seen.set(k, p.f); }
const good = ok.filter((p) => p.status === "ok"), errors = parsed.filter((p) => p.status === "error");
say(`${files.length} files: ${good.length} filled, ${pending.length} pending (empty), ${errors.length} with problems.`);
for (const p of errors) { say(`  PROBLEM ${p.f}`); for (const e of p.errors) say(`    - ${e}`); }
if (DRY) { for (const p of good) say(`  ok       ${p.f} -> ${p.entry.actId} section ${p.entry.number}`); process.exit(errors.length ? 1 : 0); }

// ---- 2. database
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is not set in .env.local."); process.exit(1); }
const main = neon(process.env.DATABASE_URL), vurl = process.env.VECTOR_DATABASE_URL_SUPPLEMENT || process.env.VECTOR_DATABASE_URL, vec = vurl ? neon(vurl) : null;
const q = (sql, text, params = []) => sql.query(text, params);
const mb = async () => Number((await q(main, "select pg_database_size(current_database()) / 1048576 as mb"))[0].mb);
const before = await mb();
if (before > MAIN_LIMIT_MB) { console.error(`The main database is ${before} MB, over the ${MAIN_LIMIT_MB} MB stop line. Nothing was loaded.`); process.exit(1); }
for (const stmt of fs.readFileSync("scripts/supplement/supplement-schema.sql", "utf8").split(/^-- @@\s*$/m)) { const t = stmt.trim(); if (t) await q(main, t); }
if (vec) await q(vec, "CREATE TABLE IF NOT EXISTS supplement_emb_256 (chunk_id text PRIMARY KEY, act_id text NOT NULL, section_key text NOT NULL, embedding halfvec(256) NOT NULL)");
const existing = new Map((await q(main, "select act_id, number, file_hash, file_name from act_sections_supplement")).map((r) => [`${r.act_id}|${r.number}`, r]));

const actCache = new Map();
/** One query per Act: its title and its open-india-law rows (number -> first row, and the reading order of the last row before a given number). */
async function actInfo(actId) {
  if (actCache.has(actId)) return actCache.get(actId);
  const title = (await q(main, "select title from acts where act_id = $1", [actId]))[0]?.title ?? null;
  const rows = title ? await q(main, "select number, ord from act_sections where act_id = $1 and number is not null order by ord", [actId]) : [];
  const byNumber = new Map(); for (const r of rows) { const k = r.number.toUpperCase(); if (!byNumber.has(k)) byNumber.set(k, r); }
  const nums = rows.filter((r) => /^[0-9]+$/.test(r.number)).map((r) => [Number(r.number), Number(r.ord)]);
  const lastOrd = rows.reduce((m, r) => Math.max(m, Number(r.ord)), 0);
  const info = { title, byNumber, lastOrd, before: (n) => nums.filter(([k]) => k < n).reduce((m, [, o]) => Math.max(m, o), 0) };
  actCache.set(actId, info); return info;
}
const stats = { added: 0, updated: 0, unchanged: 0, removed: 0, failed: 0, chunks: 0 };
const toEmbed = [];   // { entry, chunks }
for (const p of good) {
  const e = p.entry, key = `${e.actId}|${e.number}`, hash = entryHash(e);
  const A = await actInfo(e.actId);
  if (!A.title) { say(`  PROBLEM ${p.f}: no Act with the Act ID ${e.actId}.`); stats.failed++; continue; }
  const act = { title: A.title }, base = A.byNumber.get(e.number);
  if (base && !e.replaces) { say(`  PROBLEM ${p.f}: section ${e.number} of ${act.title} is already in the data. If that text is wrong, set "Replaces existing text: yes".`); stats.failed++; continue; }
  const ord = unitOrd(e.number, A.lastOrd) ?? (base ? Number(base.ord) : A.before(parseInt(e.number, 10)));
  const prev = existing.get(key);
  if (prev && prev.file_hash === hash) { stats.unchanged++; continue; }
  await q(main, `insert into act_sections_supplement (act_id, number, section_key, ord, heading, body, replaces, source, source_url, copied_on, file_name, file_hash, loaded_at)
                 values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
                 on conflict (act_id, number) do update set section_key=$3, ord=$4, heading=$5, body=$6, replaces=$7, source=$8, source_url=$9, copied_on=$10, file_name=$11, file_hash=$12, loaded_at=now()`,
    [e.actId, e.number, e.sectionKey, ord, e.heading, e.body, e.replaces, e.source, e.sourceUrl, e.copiedOn, p.f, hash]);
  prev ? stats.updated++ : stats.added++;
  const label = `${act.title}, ${unitLabel(e.number) ?? `Section ${e.number}`}${e.heading ? `: ${e.heading}` : ""}`;
  const chunks = chunkPages([e.body], { chars: 1100, overlap: 150 }).map((c, i) => ({ id: `${e.actId}|${e.sectionKey}|${i}`, text: `${label}\n${c.body}` }));
  toEmbed.push({ e, chunks }); say(`  ${prev ? "updated " : "added   "} ${p.f} -> ${act.title}, ${unitLabel(e.number) ?? `section ${e.number}`} (${e.body.length} characters, ${chunks.length} passage${chunks.length === 1 ? "" : "s"}${base ? ", replaces the existing text" : ""})`);
}
// rows whose file is now empty, deleted or no longer valid-and-present are removed (a file with a PROBLEM keeps its old row until it is fixed)
const keep = new Set(good.map((p) => `${p.entry.actId}|${p.entry.number}`)), problemFiles = new Set(errors.map((p) => p.f));
for (const [key, r] of existing) {
  if (keep.has(key) || problemFiles.has(r.file_name)) continue;
  const [actId, number] = key.split("|");
  await q(main, "delete from act_sections_supplement where act_id = $1 and number = $2", [actId, number]);
  if (vec) await q(vec, "delete from supplement_emb_256 where act_id = $1 and section_key = $2", [actId, `s${number.padStart(3, "0")}`]);
  stats.removed++; say(`  removed  ${r.file_name} (${key}): its file is empty or gone`);
}

// ---- 3. embeddings (voyage-4, 256 dimensions, normal API)
async function embed(texts) {
  const key = process.env.VOYAGE_API_KEY?.trim(); if (!key) throw new Error("VOYAGE_API_KEY is not set");
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch("https://api.voyageai.com/v1/embeddings", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(40000),
      body: JSON.stringify({ input: texts, model: "voyage-4", input_type: "document", output_dimension: 256, truncation: true }) });
    if (r.status === 429) { await sleep(30000); continue; }
    if (!r.ok) throw new Error(`voyage ${r.status}`);
    return (await r.json()).data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
  throw new Error("voyage kept answering busy");
}
if (toEmbed.length && !vec) say("  (no VECTOR_DATABASE_URL: smart search will not see these sections)");
if (toEmbed.length && vec) {
  const all = toEmbed.flatMap((t) => t.chunks.map((c) => ({ ...c, actId: t.e.actId, key: t.e.sectionKey })));
  for (const t of toEmbed) await q(vec, "delete from supplement_emb_256 where act_id = $1 and section_key = $2", [t.e.actId, t.e.sectionKey]);
  for (let i = 0; i < all.length; i += 16) {
    if (i) await sleep(GAP_MS);
    const batch = all.slice(i, i + 16), vs = await embed(batch.map((c) => c.text));
    for (let j = 0; j < batch.length; j++) await q(vec, "insert into supplement_emb_256 (chunk_id, act_id, section_key, embedding) values ($1,$2,$3,$4::halfvec) on conflict (chunk_id) do update set embedding = excluded.embedding", [batch[j].id, batch[j].actId, batch[j].key, `[${vs[j].map((n) => +n.toFixed(7)).join(",")}]`]);
    stats.chunks += batch.length; say(`  embedded ${stats.chunks} of ${all.length} passages`);
  }
}
// State-filed copies of a Central Act that has filled sections (same title): their same-numbered sections are hidden by the view act_sections_v
const norm = "regexp_replace(regexp_replace(lower(%T), '^the\\s+', ''), '[^a-z0-9]', '', 'g')";
await q(main, "delete from act_copy_of where central_id not in (select distinct act_id from act_sections_supplement)");
const copies = await q(main, `insert into act_copy_of (copy_id, central_id) select a2.act_id, a1.act_id from acts a1 join acts a2 on a2.act_id <> a1.act_id and ${norm.replace("%T", "a2.title")} = ${norm.replace("%T", "a1.title")} where a1.act_id in (select distinct act_id from act_sections_supplement) on conflict (copy_id) do update set central_id = excluded.central_id returning copy_id, central_id`);
for (const c of copies) say(`  State-filed copy ${c.copy_id} of ${c.central_id}: its same-numbered sections are hidden where the Central Act has a filled section`);
const total = (await q(main, "select count(*) as n from act_sections_supplement"))[0].n;
say(`\nDone: ${stats.added} added, ${stats.updated} updated, ${stats.unchanged} unchanged, ${stats.removed} removed, ${stats.failed} failed. ${total} supplement section(s) in the database, ${stats.chunks} passage(s) embedded now.`);
say(`Main database: ${before} MB before, ${await mb()} MB after (stop line ${MAIN_LIMIT_MB} MB).`);
process.exit(stats.failed || errors.length ? 1 : 0);
