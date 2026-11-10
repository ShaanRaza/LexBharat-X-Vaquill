import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import meta from "../../data/judgments/courts.meta.json" with { type: "json" };
import { HC_FIELDS, HC_PREFIXES, caseNumberOf, cleanTitle, courtOfId, isRegForm, parseTitleCourts, pickHcFields, regFormOf, titlesOn } from "./hcRecord.mjs";

// Every name below is invented.
const TITLES = [
  ["WP/933/2024 of TESTA FAKENAME Vs STATE OF NOWHERE", "WP/933/2024", "933/2024"],
  ["WP(C)/19571/2019 of A.B. FAKENAME AND 2 OTHERS Vs UNION", "WP(C)/19571/2019", "19571/2019"],
  ["CR. MISC./56488/2023 of FAKE PERSON Vs The State", "CR. MISC./56488/2023", "56488/2023"],
  ["RSA/05/2019 of FAKE PERSON Vs X", "RSA/05/2019", "5/2019"],
  ["/151/2022 of FAKE PERSON Vs STATE OF NOWHERE", "151/2022", "151/2022"],
  ["WRIT PETITION 609 of 1999", "WRIT PETITION 609 of 1999", "609/1999"],
  ["CIVIL APPEAL 100436 OF 2024", "CIVIL APPEAL 100436 OF 2024", "100436/2024"],
  ["WRIT PETITION 2702/2014", "WRIT PETITION 2702/2014", "2702/2014"],
  ["WRIT  PETITION   None", null, null],
  ["None None", null, null],
  ["CIVIL APPEAL", null, null],
  ["FAKE PERSON v. STATE OF NOWHERE", null, null],
  [null, null, null],
];

test("registration form and case number are read from the title; a title in any other shape gives neither", () => {
  for (const [raw, title, caseNumber] of TITLES) { assert.equal(regFormOf(raw), title, String(raw)); assert.equal(caseNumberOf(raw), caseNumber, String(raw)); }
  for (const [, title] of TITLES) if (title) assert.ok(isRegForm(title), title);
  assert.ok(!isRegForm("WP/12/2024 of FAKE PERSON Vs X"));
});

test("court from the case id: all 25 High Courts, and an unknown prefix gets no court", () => {
  const slugs = meta.map((m) => m.court).filter((c) => c !== "supreme-court-of-india").sort();
  assert.equal(slugs.length, 25);
  assert.deepEqual([...new Set(Object.values(HC_PREFIXES))].sort(), slugs);
  assert.equal(courtOfId("HCBM030098922007"), "bombay-high-court");
  assert.equal(courtOfId("WBCHCA0196862025"), "calcutta-high-court");
  assert.equal(courtOfId("HBHC010866032016"), "telangana-high-court");
  assert.equal(courtOfId("XXHC010000012020"), null);
  assert.equal(courtOfId("2024_INSC_1"), null);
  assert.equal(courtOfId(undefined), null);
});

test("only the allowed fields survive", () => {
  const row = pickHcFields({ caseId: "HCBM1", title: "WP/1/2024", petitioner: "FAKE", respondent: "FAKE", judges: ["FAKE"], benchSize: 1, advocate: "FAKE", caseNumber: null });
  assert.deepEqual(row, { caseId: "HCBM1", title: "WP/1/2024" });
  for (const k of ["petitioner", "respondent", "judges", "benchSize", "benchStrength"]) assert.ok(!HC_FIELDS.includes(k), k);
});

test("the export SQL gives the same title and case number as regFormOf() / caseNumberOf(), and the display-title step gives cleanTitle()", (t) => {
  try { execFileSync("duckdb", ["--version"]); } catch { t.skip("duckdb CLI not installed"); return; }
  const dir = mkdtempSync(path.join(tmpdir(), "hc-sql-")), pq = path.join(dir, "in_test_judgments.parquet");
  const q = (s) => (s === null ? "NULL" : `'${s.replace(/'/g, "''")}'`);
  const rows = TITLES.map(([raw], i) => `('HCBM01${String(i).padStart(10, "0")}', ${raw === null ? "NULL::VARCHAR" : q(raw)}, '1 of 2020', '2020-01-0${(i % 9) + 1}', 2020, 'DISMISSED', NULL::VARCHAR, NULL::VARCHAR, 3, 'FAKE PETITIONER', NULL::VARCHAR, ['FAKE JUDGE'])`);
  execFileSync("duckdb", ["-c", `COPY (SELECT * FROM (VALUES ${rows.join(",")}) v(case_id, title, case_number, decision_date, year, disposition, citation, date_of_registration, page_end, petitioner, respondent, judges)) TO '${pq}' (FORMAT PARQUET)`]);
  for (const d of ["_quarantine", "_manifest", "_fields", "_removed"]) execFileSync("mkdir", ["-p", path.join(dir, d)]);
  const sql = readFileSync(new URL("../../../scripts/judgments/export-judgments-hc.sql", import.meta.url), "utf8")
    .replaceAll("__FILE__", pq).replaceAll("__OUT__", dir).replaceAll("__TMP__", dir).replaceAll("__SLUG__", "x").replaceAll("__YF__", "1900").replaceAll("__YT__", "2026").replaceAll("__PREFIXES__", "'HCBM'");
  execFileSync("duckdb", ["-c", sql]);
  execFileSync(process.execPath, [fileURLToPath(new URL("../../../scripts/judgments/hc-display-titles.mjs", import.meta.url)), path.join(dir, "_removed", "x.json"), path.join(dir, "x.ndjson"), path.join(dir, "x.filtered.ndjson")]);
  const out = new Map(readFileSync(path.join(dir, "x.ndjson"), "utf8").trim().split("\n").map((l) => JSON.parse(l)).map((r) => [r.caseId, r]));
  for (const r of out.values()) assert.ok(!("titleRaw" in r), "the raw title never reaches a page");
  TITLES.forEach(([raw, title, caseNumber], i) => { const r = out.get(`HCBM01${String(i).padStart(10, "0")}`); assert.equal(r.title, title, String(raw)); assert.equal(r.caseNumber, caseNumber, String(raw)); assert.equal(r.caseNumberRecorded, "1 of 2020"); assert.ok(!("petitioner" in r) && !("judges" in r)); assert.equal(r.displayTitle, cleanTitle(raw) ?? undefined, String(raw)); });
  const removed = JSON.parse(readFileSync(path.join(dir, "_removed", "x.json"), "utf8"));
  assert.equal(removed.parties_removed, TITLES.length); assert.equal(removed.judges_removed, TITLES.length);
  const shown = TITLES.filter(([raw]) => cleanTitle(raw)).length, withTitle = TITLES.filter(([raw]) => raw && raw.replace(/None/g, "").trim()).length;
  assert.equal(removed.display_title_shown, shown); assert.equal(removed.display_title_shown + removed.display_title_dropped, withTitle);
});

test("a case id from another court is quarantined, never listed", (t) => {
  try { execFileSync("duckdb", ["--version"]); } catch { t.skip("duckdb CLI not installed"); return; }
  const dir = mkdtempSync(path.join(tmpdir(), "hc-sql-")), pq = path.join(dir, "in.parquet");
  execFileSync("duckdb", ["-c", `COPY (SELECT * FROM (VALUES ('HCBM010000012020','WP/1/2020','1 of 2020','2020-01-01',2020,NULL::VARCHAR,NULL::VARCHAR,NULL::VARCHAR,1,NULL::VARCHAR,NULL::VARCHAR,NULL::VARCHAR[]), ('DLHC010000012020','WP/2/2020','2 of 2020','2020-01-01',2020,NULL::VARCHAR,NULL::VARCHAR,NULL::VARCHAR,1,NULL::VARCHAR,NULL::VARCHAR,NULL::VARCHAR[]), ('12345','WP/3/2020','3 of 2020','2020-01-01',2020,NULL::VARCHAR,NULL::VARCHAR,NULL::VARCHAR,1,NULL::VARCHAR,NULL::VARCHAR,NULL::VARCHAR[])) v(case_id, title, case_number, decision_date, year, disposition, citation, date_of_registration, page_end, petitioner, respondent, judges)) TO '${pq}' (FORMAT PARQUET)`]);
  for (const d of ["_quarantine", "_manifest", "_fields", "_removed"]) execFileSync("mkdir", ["-p", path.join(dir, d)]);
  const sql = readFileSync(new URL("../../../scripts/judgments/export-judgments-hc.sql", import.meta.url), "utf8")
    .replaceAll("__FILE__", pq).replaceAll("__OUT__", dir).replaceAll("__TMP__", dir).replaceAll("__SLUG__", "x").replaceAll("__YF__", "1900").replaceAll("__YT__", "2026").replaceAll("__PREFIXES__", "'HCBM'");
  execFileSync("duckdb", ["-c", sql]);
  const listed = readFileSync(path.join(dir, "x.ndjson"), "utf8").trim().split("\n").map((l) => JSON.parse(l).caseId);
  const quarantined = JSON.parse(readFileSync(path.join(dir, "_quarantine", "x.json"), "utf8"));
  assert.deepEqual(listed, ["HCBM010000012020"]);
  assert.deepEqual(quarantined.map((q) => [q.caseId, q.reason]), [["12345", "record id names another court"], ["DLHC010000012020", "record id names another court"]]);
});

test("the title switch: off by default, on by court slug or *, and a typo keeps every court off", () => {
  for (const v of [undefined, "", "none", " None "]) assert.equal(titlesOn("bombay-high-court", v), false, String(v));
  assert.equal(titlesOn("bombay-high-court", "Bombay-High-Court, kerala-high-court"), true);
  assert.equal(titlesOn("delhi-high-court", "bombay-high-court"), false);
  assert.equal(titlesOn("delhi-high-court", "*"), true);
  assert.equal(titlesOn("supreme-court-of-india", "*"), false);   // the switch is for High Courts; Supreme Court titles are unchanged
  for (const v of ["bombay", "bombay-high-court,bombya-high-court", "*,bombay-high-court", "none,bombay-high-court"]) { assert.equal(titlesOn("bombay-high-court", v), false, v); assert.ok(parseTitleCourts(v).bad.length > 0, v); }
  const row = { caseId: "HCBM1", title: "WP/1/2024", displayTitle: "A KUMAR Vs B SINGH" };
  assert.deepEqual(pickHcFields(row), { caseId: "HCBM1", title: "WP/1/2024" });
  assert.deepEqual(pickHcFields(row, { titles: true }), row);
});
