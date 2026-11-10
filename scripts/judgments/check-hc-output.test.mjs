import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fixture from "./pii-guard-fixture.json" with { type: "json" };
import { checkDir, rowHits } from "./check-hc-output.mjs";

const GUARD = fileURLToPath(new URL("./check-hc-output.mjs", import.meta.url));

test("shared fixture: clean rows pass, every injected name, address, judge and bench field is caught", () => {
  for (const row of fixture.clean) assert.deepEqual(rowHits(row), [], row.caseId);
  for (const { row, expect } of fixture.dirty) assert.deepEqual(rowHits(row).sort(), [...expect].sort(), row.caseId);
});

/** A minimal export folder with one clean page; `extra` adds files to it. */
function exportDir(extra = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "hc-guard-"));
  const files = { "court=bombay-high-court/year=2024/page=1/data_0.json": fixture.clean, "court=bombay-high-court/year=2024/facets.json": { disposition: [{ value: "Disposed of", slug: "disposed-of", count: 1 }] },
    "_manifest/bombay-high-court.json": [{ year: 2024, cases: 5, pages: 1 }], "search/shard=001.json": { "#933/2024": [0], "@2024": [0] }, ...extra };
  for (const [f, v] of Object.entries(files)) { mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); writeFileSync(path.join(dir, f), JSON.stringify(v)); }
  return dir;
}

test("a clean export passes", () => {
  const { hits, per } = checkDir(exportDir());
  assert.deepEqual(hits, []); assert.equal(per["bombay-high-court"].rows, fixture.clean.length);
});

test("an injected fake name and address fails the guard, and the CLI exits 1 without printing the value", () => {
  const dir = exportDir({ "court=bombay-high-court/year=2024/page=2/data_0.json": [{ caseId: "HCBM010000992024", title: "WP/99/2024 of TESTA FAKENAME Vs STATE", disposition: "R/o 12 Fake Lane, Fakepur 411001" }] });
  const { hits } = checkDir(dir);
  assert.ok(hits.some((h) => /title: not cleaned/.test(h.why)));
  assert.ok(hits.some((h) => /disposition: PIN code/.test(h.why)) && hits.some((h) => /disposition: relation/.test(h.why)));
  const r = spawnSync(process.execPath, [GUARD, dir], { encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.ok(!/FAKENAME|Fake Lane|411001/.test(r.stdout + r.stderr), "the guard must not print the values it found");
});

test("person fields, a bench filter and word keys in the search index all fail", () => {
  const dir = exportDir({ "court=bombay-high-court/year=2024/bench=single/page=1/data_0.json": [], "court=bombay-high-court/year=2024/page=3/data_0.json": [{ caseId: "HCBM1", petitioner: "FAKE", judges: ["FAKE"] }],
    "search/shard=002.json": { fakename: [1] } });
  const why = checkDir(dir).hits.map((h) => h.why).join("\n");
  assert.match(why, /bench filter is not allowed/); assert.match(why, /field "petitioner" is not allowed/); assert.match(why, /field "judges" is not allowed/); assert.match(why, /1 word keys/);
});

test("no code reads pdf_exists (aws-hc-meta's pdf_exists is never true)", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url)), found = [];
  const walk = (d) => { for (const e of readdirSync(d)) { if (["node_modules", ".next", ".git"].includes(e)) continue; const p = path.join(d, e);
    if (statSync(p).isDirectory()) walk(p); else if (/\.(m?[jt]sx?|py|sql|sh)$/.test(e) && !e.includes(".test.") && readFileSync(p, "utf8").includes("pdf_exists")) found.push(path.relative(root, p)); } };
  walk(path.join(root, "src")); walk(path.join(root, "scripts"));
  assert.deepEqual(found, []);
});
