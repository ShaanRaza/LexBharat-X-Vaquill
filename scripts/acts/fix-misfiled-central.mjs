#!/usr/bin/env node
// Moves Central Acts that the dataset filed only under States into category 'central' (Neon `acts`). The dataset's own values stay in raw_category / raw_state.
// usage: node scripts/acts/fix-misfiled-central.mjs [--apply]     (default is a dry run that prints the list)
// RULE: a state-filed Act is a Central Act copy when its title (lower-cased, "The" and punctuation removed) + year occurs in >= 4 different states, carries no state name or
//   amendment/repeal wording, and and at least one copy has text. One copy per Act is promoted: the one with the most sections (ties: lowest act_id); the other state copies stay as filed.
//   Skipped when Central already holds that Act (same base title + year, ", NN of YYYY, (Rep. ...)" suffix removed) with >= 80% of the sections (e.g. IPC, Evidence Act).
import { neon } from "@neondatabase/serverless";
import { env } from "./bakeoff-lib.mjs";

const APPLY = process.argv.includes("--apply");
const sql = neon(env.DATABASE_URL);
const STATE_WORDS = "pradesh|bengal|assam|goa|delhi|kerala|odisha|orissa|punjab|haryana|gujarat|karnataka|tamil|telangana|bihar|jharkhand|manipur|tripura|nagaland|mizoram|sikkim|meghalaya|rajasthan|uttar|madhya|chhattisgarh|andhra|puducherry|pondicherry|chandigarh|dadra|ladakh|jammu|kashmir|uttarakhand|himachal|maharashtra|andaman|lakshadweep|daman|diu|arunachal|portuguese";
const norm = (s) => s.toLowerCase().replace(/^the\s+/, "").replace(/,?\s*\d+\s+of\s+\d{4}.*$/, "").replace(/[^a-z0-9]+/g, " ").replace(/\s*\b(1[89]|20)\d\d\s*$/, "").trim();

await sql.query("ALTER TABLE acts ADD COLUMN IF NOT EXISTS raw_category text, ADD COLUMN IF NOT EXISTS raw_state text, ADD COLUMN IF NOT EXISTS category_note text");
await sql.query("UPDATE acts SET raw_category = category, raw_state = state WHERE raw_category IS NULL");

const st = await sql.query(`SELECT act_id, title, year, state, section_count FROM acts WHERE category = 'state' AND year IS NOT NULL
  AND title !~* '(amend|repeal|ordinance|validat|draft)' AND title !~* '\\m(${STATE_WORDS})\\M'`);
const central = await sql.query("SELECT title, year, section_count FROM acts WHERE raw_category = 'central'");
const bestCentral = new Map();
for (const c of central) { const k = `${norm(c.title)}|${c.year}`; bestCentral.set(k, Math.max(bestCentral.get(k) ?? 0, c.section_count)); }

const groups = new Map();
for (const a of st) { const k = `${norm(a.title)}|${a.year}`; (groups.get(k) ?? groups.set(k, []).get(k)).push(a); }
const promote = [], skipped = [];
for (const [k, copies] of groups) {
  const states = new Set(copies.map((c) => c.state)).size;
  if (states < 4) continue;
  copies.sort((a, b) => b.section_count - a.section_count || a.act_id.localeCompare(b.act_id, "en", { numeric: true }));
  const pick = copies[0];
  if (pick.section_count < 1) continue; // no text in any copy
  const have = bestCentral.get(k) ?? 0;
  if (have >= 0.8 * pick.section_count) { skipped.push({ title: pick.title, year: pick.year, centralSections: have, stateSections: pick.section_count }); continue; }
  promote.push({ ...pick, copies: copies.length, states });
}
console.log(`${promote.length} Acts to move to Central; ${skipped.length} skipped because Central already has them`);
for (const p of promote) console.log(`  ${p.act_id}\t${p.title} (${p.year})\t${p.section_count} sections\tcopy of ${p.copies} in ${p.states} states (kept: ${p.state})`);
for (const s of skipped) console.log(`  SKIP ${s.title} (${s.year}): Central has ${s.centralSections} sections vs ${s.stateSections}`);
if (APPLY) {
  for (const p of promote) await sql.query("UPDATE acts SET category = 'central', state = NULL, category_note = $2 WHERE act_id = $1",
    [p.act_id, `Filed under ${p.state} in the dataset; the same Act is filed in ${p.states} states, so it is a Central Act (rule in scripts/acts/fix-misfiled-central.mjs).`]);
  console.log("applied");
}
