#!/usr/bin/env node
// W10 item 1: status corrections. The dataset's own value stays in act_status_override.raw_status; acts.act_status shows the corrected value.
// Writes src/config/status-overrides.json (used for the static Act lists) and the "Repealed — see X" notes (src/config/repealed-acts.json).
// usage: node scripts/w10/status-overrides.mjs [--apply]   (default: dry run, prints the list)
import fs from "node:fs";
import { q } from "./env.mjs";
const APPLY = process.argv.includes("--apply");
const R = (id, name, short, newActId, newName) => ({ id, name, short, newActId, newName });
// Each rule: exact-title regex for the Act and its State-filed copies (amendments of a State are NOT touched), the new law, the reason, the evidence.
const RULES = [
  { re: /^the indian penal code(,? ?1860)?$/i, year: [1860, null], name: "Indian Penal Code, 1860", short: "BNS", newActId: "IND_central_20062", newName: "Bharatiya Nyaya Sanhita, 2023",
    reason: "Repealed by the Bharatiya Nyaya Sanhita, 2023 (Act 45 of 2023), in force from 1 July 2024. The dataset already holds the Central Act as repealed (IND_REP_659_1860); this is a State-filed copy of the same Act.", basis: "IND_REP_659_1860" },
  { re: /^the code of criminal procedure(,? ?1973| act)?$/i, year: [1973, null], name: "Code of Criminal Procedure, 1973", short: "BNSS", newActId: "IND_central_20099", newName: "Bharatiya Nagarik Suraksha Sanhita, 2023",
    reason: "Repealed by the Bharatiya Nagarik Suraksha Sanhita, 2023 (Act 46 of 2023), in force from 1 July 2024. The dataset still lists it as in force.", basis: "IND_central_20099" },
  { re: /^the indian evidence act,? ?(1872)?$/i, year: [1872, null], name: "Indian Evidence Act, 1872", short: "BSA", newActId: "IND_central_20063", newName: "Bharatiya Sakshya Adhiniyam, 2023",
    reason: "Repealed by the Bharatiya Sakshya Adhiniyam, 2023 (Act 47 of 2023), in force from 1 July 2024. The dataset already holds the Central Act as repealed (IND_REP_971_1872); this is a State-filed copy of the same Act.", basis: "IND_REP_971_1872" },
  { re: /^the minimum wages act,? ?(1948)?( \(central act\))?$/i, year: [1948, null], name: "Minimum Wages Act, 1948", short: "Code on Wages", newActId: "IND_central_15793", newName: "The Code on Wages, 2019",
    reason: "Repealed by the Code on Wages, 2019 (Act 29 of 2019). The dataset holds this Act twice: as repealed (IND_REP_2463_1948, 'Rep., Act 29 of 2019') and as in force; the repealed record is India Code's.", basis: "IND_REP_2463_1948" },
  { re: /^the payment of wages act,? ?(1936)?( \(central act\))?$/i, year: [1936, null], name: "Payment of Wages Act, 1936", short: "Code on Wages", newActId: "IND_central_15793", newName: "The Code on Wages, 2019",
    reason: "Repealed by the Code on Wages, 2019 (Act 29 of 2019). The dataset holds this Act twice: as repealed (IND_REP_2130_1936, 'Rep., Act 29 of 2019') and as in force; the repealed record is India Code's.", basis: "IND_REP_2130_1936" },
  { re: /^the factories act,? ?(1948)?( ?\(central act\))?$/i, year: [1948, null], name: "Factories Act, 1948", short: "OSH Code", newActId: "IND_central_22041", newName: "The Occupational Safety, Health and Working Conditions Code, 2020",
    reason: "Repealed by the Occupational Safety, Health and Working Conditions Code, 2020 (Act 37 of 2020). The dataset holds this Act twice: as repealed (IND_REP_2501_1948, 'Rep., Act 37 of 2020') and as in force; the repealed record is India Code's.", basis: "IND_REP_2501_1948" },
  { re: /^the maternity benefit act,? ?(1961)?( \(central act\))?$/i, year: [1961, null], name: "Maternity Benefit Act, 1961", short: "Code on Social Security", newActId: "IND_central_16823", newName: "The Code on Social Security, 2020",
    reason: "Repealed by the Code on Social Security, 2020 (Act 36 of 2020). The dataset holds this Act twice: as repealed (IND_REP_3081_1961, 'Rep., Act 36 of 2020') and as in force; the repealed record is India Code's.", basis: "IND_REP_3081_1961" },
];
const rows = await q("SELECT act_id, title, year, category, state, act_status FROM acts WHERE act_status = 'in_force' OR act_status IS NULL");
const out = [];
for (const a of rows) {
  const t = a.title.trim();
  const rule = RULES.find((r) => r.re.test(t) && r.year.includes(a.year));
  if (rule) out.push({ ...a, rule });
}
const by = {};
for (const o of out) (by[o.rule.name] ??= []).push(o);
for (const [k, v] of Object.entries(by)) console.log(String(v.length).padStart(3), k, "| central:", v.filter((x) => x.category === "central").map((x) => x.act_id).join(",") || "-");
if (!APPLY) { console.log("dry run; --apply to write"); process.exit(0); }
await q(`CREATE TABLE IF NOT EXISTS act_status_override (act_id text PRIMARY KEY, raw_status text, status text NOT NULL, reason text NOT NULL, basis text, set_on date NOT NULL DEFAULT current_date)`);
for (const o of out) {
  await q(`INSERT INTO act_status_override (act_id, raw_status, status, reason, basis) VALUES ($1,$2,'repealed',$3,$4) ON CONFLICT (act_id) DO UPDATE SET reason = EXCLUDED.reason, basis = EXCLUDED.basis`, [o.act_id, o.act_status, o.rule.reason, o.rule.basis]);
}
await q(`UPDATE acts a SET act_status = o.status FROM act_status_override o WHERE o.act_id = a.act_id AND a.act_status <> o.status`);
const all = await q("SELECT act_id, raw_status, status, reason, basis FROM act_status_override ORDER BY act_id");
fs.writeFileSync("src/config/status-overrides.json", JSON.stringify({ _note: "Corrections to the dataset's act_status (the dataset's own value is kept as rawStatus). Mirror of the Neon table act_status_override; written by scripts/w10/status-overrides.mjs. Each entry cites its reason.", overrides: Object.fromEntries(all.map((r) => [r.act_id, { status: r.status, rawStatus: r.raw_status, reason: r.reason, basis: r.basis }])) }, null, 1) + "\n");
const notes = JSON.parse(fs.readFileSync("src/config/repealed-acts.json", "utf8"));
for (const o of out) notes[o.act_id] = { name: o.rule.name, newActId: o.rule.newActId, newName: o.rule.newName, short: o.rule.short };
fs.writeFileSync("src/config/repealed-acts.json", JSON.stringify(notes, null, 2) + "\n");
console.log("applied", out.length);
