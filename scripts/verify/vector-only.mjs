// Vector search ALONE (no keywords, no synonyms, no boosts, no lookups): the app's own query embedding (src/lib/acts/embed.ts) and its own vector stores (vectorStore.ts) -> nearest chunks -> distinct sections -> titles.
// Prints the top sections per query and whether the expected one is in the top 3 / top 10. Read-only. Run: node scripts/verify/vector-only.mjs   (needs VOYAGE_API_KEY and the vector URLs in .env.local; one Voyage request for all queries)
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
for (const l of fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const { embedQuery, embedMany, VOYAGE_MODEL, EMBED_DIM } = await import("../../src/lib/acts/embed.ts");
const { vectorStores, regulatoryStore, scVectorStore } = await import("../../src/lib/acts/vectorStore.ts");
const { distinctSections } = await import("../../src/lib/acts/semantic.mjs");
const main = neon(process.env.DATABASE_URL), reg = neon(process.env.REG_DATABASE_URL || process.env.DATABASE_URL);
// expect: [title pattern, section number] pairs; any of them counts
const CASES = [
  { q: "punishment for stealing", scope: "acts", expect: [[/bharatiya nyaya sanhita/i, "303"], [/indian penal code/i, "379"]] },
  { q: "notice after cheque bounces", scope: "acts", expect: [[/negotiable instruments/i, "138"]] },
  { q: "time limit for filing a consumer complaint", scope: "acts", expect: [[/consumer protection act, 2019/i, "69"], [/consumer protection/i, "24A"]] },
  { q: "bail for a non-bailable offence", scope: "acts", expect: [[/bharatiya nagarik suraksha/i, "480"], [/code of criminal procedure/i, "437"]] },
  { q: "cruelty by husband or his relatives towards a wife", scope: "acts", expect: [[/bharatiya nyaya sanhita/i, "85"], [/indian penal code/i, "498A"]] },
  { q: "insider trading disclosure obligations of promoters", scope: "reg", expect: [[/insider trading|prohibition of insider/i, null]] },
  { q: "right to privacy is a fundamental right under Article 21", scope: "sc", expect: [[/./, null]] },
];
await embedMany(CASES.map((c) => c.q));   // ONE request for all (the free account allows 3 a minute); the searches then hit the cache
console.log(`embedding: ${VOYAGE_MODEL}, ${EMBED_DIM}-d, input_type query (src/lib/acts/embed.ts)\n`);
let pass3 = 0, pass10 = 0, scored = 0;
for (const c of CASES) {
  const stores = c.scope === "acts" ? vectorStores() : [c.scope === "reg" ? regulatoryStore() : scVectorStore()];
  const v = await embedQuery(c.q, stores[0].dim);
  const near = (await Promise.all(stores.map((s) => s.nearest(v, 200)))).flat().sort((a, b) => a.distance - b.distance);
  const sec = distinctSections(near, 10);
  let rows;
  if (c.scope === "sc") rows = sec.map((s) => ({ t: `SC case ${s.actId} chunk ${s.sectionKey}`, n: null }));
  else {
    const db = c.scope === "reg" ? reg : main, [sv, av] = c.scope === "reg" ? ["reg_sections", "reg_acts"] : ["act_sections_v", "acts"];
    const info = await db.query(`SELECT s.act_id, s.section_key, s.number, s.heading, a.title FROM ${sv} s JOIN ${av} a USING (act_id) JOIN unnest($1::text[], $2::text[]) k(a, sk) ON s.act_id = k.a AND s.section_key = k.sk`, [sec.map((s) => s.actId), sec.map((s) => s.sectionKey)]);
    const m = new Map(info.map((r) => [`${r.act_id}|${r.section_key}`, r]));
    rows = sec.map((s) => { const r = m.get(`${s.actId}|${s.sectionKey}`); return { t: r ? `${r.title} s.${r.number} ${r.heading ?? ""}`.slice(0, 90) : `${s.actId}|${s.sectionKey}`, n: r?.number ?? null, title: r?.title ?? "" }; });
  }
  const norm = (t) => String(t).replace(/[-_]+/g, " ");   // some titles are filed as "INDIAN-PENAL-CODE-1860"
  const hit = (r) => c.expect.some(([tp, num]) => tp.test(norm(r.title ?? r.t)) && (num === null || String(r.n).toUpperCase() === num));
  const at = rows.findIndex(hit) + 1;
  const scoredCase = c.scope !== "sc"; if (scoredCase) { scored++; if (at && at <= 3) pass3++; if (at && at <= 10) pass10++; }
  console.log(`Q: ${c.q}   [${c.scope}]  expected found at rank: ${scoredCase ? (at || "not in top 10") : "(judged by eye)"}`);
  rows.slice(0, 5).forEach((r, i) => console.log(`   ${i + 1}. ${r.t}`));
}
console.log(`\ntop-3: ${pass3}/${scored}   top-10: ${pass10}/${scored}`);
