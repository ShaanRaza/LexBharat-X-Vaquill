import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import meta from "../../data/judgments/courts.meta.json" with { type: "json" };
import { HC_FIELDS, HC_PREFIXES, courtOfId, isRegForm, pickHcFields, regTitle } from "./hcRecord.mjs";

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

test("title is cut to its registration form; the case number is read from it; any other title is dropped", () => {
  for (const [raw, title, caseNumber] of TITLES) assert.deepEqual(regTitle(raw), { title, caseNumber }, String(raw));
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

test("the export SQL gives the same title and case number as regTitle()", (t) => {
  try { execFileSync("duckdb", ["--version"]); } catch { t.skip("duckdb CLI not installed"); return; }
  const dir = mkdtempSync(path.join(tmpdir(), "hc-sql-")), pq = path.join(dir, "in_test_judgments.parquet");
  const q = (s) => (s === null ? "NULL" : `'${s.replace(/'/g, "''")}'`);
  const rows = TITLES.map(([raw], i) => `('HCBM01${String(i).padStart(10, "0")}', ${raw === null ? "NULL::VARCHAR" : q(raw)}, '1 of 2020', '2020-01-0${(i % 9) + 1}', 2020, 'DISMISSED', NULL::VARCHAR, NULL::VARCHAR, 3, 'FAKE PETITIONER', NULL::VARCHAR, ['FAKE JUDGE'])`);
  execFileSync("duckdb", ["-c", `COPY (SELECT * FROM (VALUES ${rows.join(",")}) v(case_id, title, case_number, decision_date, year, disposition, citation, date_of_registration, page_end, petitioner, respondent, judges)) TO '${pq}' (FORMAT PARQUET)`]);
  for (const d of ["_quarantine", "_manifest", "_fields", "_removed"]) execFileSync("mkdir", ["-p", path.join(dir, d)]);
  const sql = readFileSync(new URL("../../../scripts/judgments/export-judgments-hc.sql", import.meta.url), "utf8")
    .replaceAll("__FILE__", pq).replaceAll("__OUT__", dir).replaceAll("__TMP__", dir).replaceAll("__SLUG__", "x").replaceAll("__YF__", "1900").replaceAll("__YT__", "2026").replaceAll("__PREFIXES__", "'HCBM'");
  execFileSync("duckdb", ["-c", sql]);
  const out = new Map(readFileSync(path.join(dir, "x.ndjson"), "utf8").trim().split("\n").map((l) => JSON.parse(l)).map((r) => [r.caseId, r]));
  TITLES.forEach(([raw, title, caseNumber], i) => { const r = out.get(`HCBM01${String(i).padStart(10, "0")}`); assert.equal(r.title, title, String(raw)); assert.equal(r.caseNumber, caseNumber, String(raw)); assert.equal(r.caseNumberRecorded, "1 of 2020"); assert.ok(!("petitioner" in r) && !("judges" in r)); });
  const removed = JSON.parse(readFileSync(path.join(dir, "_removed", "x.json"), "utf8"));
  assert.equal(removed.parties_removed, TITLES.length); assert.equal(removed.judges_removed, TITLES.length);
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
