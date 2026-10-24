#!/usr/bin/env node
// W10 item 8: recovers chapter labels by sandwiching. Chapters are contiguous and in order, and a verified label sits on the section where a chapter STARTS. A numbered section with no label that lies between
// a labelled section of Chapter N and the next labelled section, which starts Chapter N+1 (consecutive numbers, so no chapter start was missed in between), belongs to Chapter N; and so does one between two sections labelled the same. Labels are copied only that way (never guessed from titles); the row gets the flag 'chapter_inferred' (the original
// stays recoverable: flags + chapter). usage: node scripts/w10/chapters.mjs [--apply]
import { q } from "./env.mjs";
const APPLY = process.argv.includes("--apply");
const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100 };
const romanVal = (label) => { const m = /^Chapter ([IVXLC]+)([A-Z]?)\b/.exec(label ?? ''); if (!m || m[2]) return null; let t = 0; const r = m[1]; for (let i = 0; i < r.length; i++) { const v = ROMAN[r[i]], n = ROMAN[r[i + 1]] ?? 0; t += v < n ? -v : v; } return t; };
const romanNext = (a, b) => { const x = romanVal(a), y = romanVal(b); return x !== null && y !== null && y === x + 1; };
const all = await q(`SELECT act_id, section_key, chapter FROM act_sections WHERE number IS NOT NULL AND status <> 'garbled' ORDER BY act_id, ord`);
const rows = []; let i0 = 0;
while (i0 < all.length) {
  let j = i0; while (j < all.length && all[j].act_id === all[i0].act_id) j++;
  const grp = all.slice(i0, j), nextLab = new Array(grp.length); let nx = null;
  for (let k = grp.length - 1; k >= 0; k--) { nextLab[k] = nx; if (grp[k].chapter) nx = grp[k].chapter; }
  let prev = null;
  grp.forEach((r, k) => { if (r.chapter) prev = r.chapter; else if (prev && (prev === nextLab[k] || romanNext(prev, nextLab[k]))) rows.push({ act_id: r.act_id, section_key: r.section_key, prev_ch: prev }); });
  i0 = j;
}
const total = await q(`SELECT count(*) FILTER (WHERE chapter IS NULL)::int nolabel, count(*)::int n FROM act_sections WHERE number IS NOT NULL AND status <> 'garbled'`);
console.log({ candidates: rows.length, ...total[0] });
if (!APPLY && !process.argv.includes("--sample")) process.exit(0);
const CH = 2000;
for (let i = 0; APPLY && i < rows.length; i += CH) {
  const b = rows.slice(i, i + CH);
  await q(`UPDATE act_sections s SET chapter = k.ch, flags = array_append(s.flags, 'chapter_inferred') FROM unnest($1::text[], $2::text[], $3::text[]) AS k(a, sk, ch) WHERE s.act_id = k.a AND s.section_key = k.sk AND s.chapter IS NULL AND NOT ('chapter_inferred' = ANY(s.flags))`, [b.map((r) => r.act_id), b.map((r) => r.section_key), b.map((r) => r.prev_ch)]);
}
if (APPLY) console.log("applied", rows.length);
if (process.argv.includes("--sample")) {
  for (const r of rows.filter((_, i) => i % 1300 === 0)) {
    const ctx = await q(`SELECT number, left(coalesce(chapter,'-'),40) ch, left(coalesce(heading,''),30) h FROM act_sections WHERE act_id=$1 ORDER BY ord`, [r.act_id]);
    const at = ctx.findIndex((c) => false); console.log(r.act_id, r.section_key, '->', r.prev_ch);
    const k = (await q(`SELECT ord FROM act_sections WHERE act_id=$1 AND section_key=$2`, [r.act_id, r.section_key]))[0].ord;
    console.log((await q(`SELECT number, left(coalesce(chapter,'-'),40) ch, left(coalesce(heading,''),30) h FROM act_sections WHERE act_id=$1 AND ord BETWEEN $2 AND $3 ORDER BY ord`, [r.act_id, k - 2, k + 2])).map((x) => `${x.number}|${x.ch}|${x.h}`).join("  //  "));
  }
}
