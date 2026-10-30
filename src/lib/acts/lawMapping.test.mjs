import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import data from "../../config/law-mapping.json" with { type: "json" };
import repealed from "../../config/repealed-acts.json" with { type: "json" };
import common from "../../config/old-to-new-common.json" with { type: "json" };
import { lookup, presentation, rowLinks, rowsFor, UNVERIFIED_LABEL, PAIRS, isChecked, checkedCount, commonGroups } from "./lawMapping.mjs";

test("old -> new: 302 IPC finds BNS 103(1)", () => {
  const r = lookup(data, "302 IPC");
  assert.equal(r.kind, "old");
  assert.deepEqual(r.rows.map((x) => `${x.new_law} ${x.new_section}`), ["bns 103(1)"]);
  assert.equal(lookup(data, "IPC section 304B").rows[0].new_section, "80");
  assert.equal(lookup(data, "Evidence Act 65B").rows[0].new_law, "bsa");
});
test("new -> old: 103 BNS finds IPC 302, with or without a sub-section", () => {
  for (const q of ["103 BNS", "103(1) BNS", "section 103 of the Bharatiya Nyaya Sanhita"]) {
    const r = lookup(data, q);
    assert.equal(r.kind, "new", q);
    assert.deepEqual(r.rows.map((x) => `${x.old_law} ${x.old_section}`), ["ipc 302"], q);
  }
  assert.equal(lookup(data, "482 BNSS").rows[0].old_section, "438");
});
test("the same number in different laws does not cross over", () => {
  assert.equal(lookup(data, "482 CrPC").rows[0].new_section, "528");
  assert.equal(lookup(data, "482 BNSS").rows[0].old_section, "438");
});
test("not understood, or no row: null / empty rows", () => {
  assert.equal(lookup(data, "hello world"), null);
  assert.equal(lookup(data, ""), null);
  assert.deepEqual(lookup(data, "9999 IPC").rows, []);
});
test("unverified rows are never shown as fact", () => {
  for (const r of data.rows) {
    const p = presentation(r);
    if (r.status === "verified") assert.deepEqual([p.fact, p.label], [true, null]);
    else assert.deepEqual([p.fact, p.label], [false, UNVERIFIED_LABEL]);
  }
  assert.equal(presentation({ status: "something-else" }).fact, false);
  assert.equal(presentation({}).fact, false);
});
test("what-changed note appears only when the row has one", () => {
  assert.equal(presentation({ status: "unverified" }).whatChanged, null);
  assert.equal(presentation({ status: "unverified", what_changed: "Renumbered." }).whatChanged, "Renumbered.");
  assert.ok(data.rows.every((r) => !r.what_changed), "no what_changed text was invented");
});
test("a section is linked only when it is confirmed to be in our data; confirmed ones link to the right Act", () => {
  for (const r of data.rows) {
    const l = rowLinks(r, data);
    assert.equal(l.old !== null, r.old_in_data === true, `${r.old_law} ${r.old_section} old link`);
    assert.equal(l.new !== null, r.new_in_data === true, `${r.new_law} ${r.new_section} new link`);
  }
  const l = rowLinks({ ...data.rows[1], old_in_data: true, new_in_data: false }, data);
  assert.equal(l.old, "/law/IND_REP_659_1860/s302");
  assert.equal(l.new, null);
});
test("data file format: required fields, valid values, no duplicate old sections", () => {
  const req = ["old_law", "old_section", "old_title", "new_law", "new_section", "new_title", "status", "source"];
  const seen = new Set();
  for (const r of data.rows) {
    for (const k of req) assert.ok(typeof r[k] === "string" && r[k].trim(), `${k} missing in ${r.old_law} ${r.old_section}`);
    assert.ok(["verified", "unverified"].includes(r.status));
    assert.ok(PAIRS.some(([o, n]) => o === r.old_law && n === r.new_law), `bad pair ${r.old_law}->${r.new_law}`);
    const key = `${r.old_law}:${r.old_section.toUpperCase()}`;
    assert.ok(!seen.has(key), `duplicate ${key}`); seen.add(key);
    if (r.status === "verified") {
      assert.match(r.source, /^((src|docs|scripts)\/|Checked against our data on \d{4}-\d{2}-\d{2}:)/, "a verified row must cite a file in this repo or say when it was checked against our data");
      if (r.source.startsWith("Checked against our data")) assert.ok(r.old_in_data === true && r.new_in_data === true, `verified-against-data row needs both sections in data: ${r.old_law} ${r.old_section}`);
    }
    for (const k of ["old_in_data", "new_in_data"]) assert.ok(!(k in r) || typeof r[k] === "boolean");
  }
  for (const [o] of PAIRS) assert.ok(rowsFor(data, o).length > 0);
});
test("Act ids agree with repealed-acts.json and exist in the Acts list", () => {
  const acts = new Set(JSON.parse(readFileSync(new URL("../../data/acts/acts.legislation.json", import.meta.url), "utf8")).map((a) => a.actId));
  for (const [o, n] of PAIRS) {
    assert.equal(data.laws[o].actId && repealed[data.laws[o].actId].newActId, data.laws[n].actId);
    assert.ok(acts.has(data.laws[o].actId) && acts.has(data.laws[n].actId));
  }
});
test("the first-screen list: every named section is in the file and checked against our data", () => {
  const groups = commonGroups(data, common);
  assert.equal(groups.length, common.groups.length, "a listed group has no row in law-mapping.json");
  assert.equal(groups.flatMap((g) => g.rows).length, common.groups.flatMap((g) => g.rows).length);
  for (const g of groups) for (const r of g.rows) assert.ok(isChecked(r) && r.status === "verified", `${g.label}: ${r.old_law} ${r.old_section}`);
  assert.deepEqual(groups.map((g) => g.label), ["Murder", "Theft", "Cheating", "Arrest", "Bail", "FIR", "Confessions"]);
  assert.ok(groups.flatMap((g) => g.rows).length < 15, "a short list, not the whole table");
});
test("checked-against-our-data count follows the linkable flag", () => {
  assert.equal(checkedCount([{ linkable: true }, { linkable: false }, { old_in_data: true, new_in_data: true }, {}]), 2);
  for (const [o] of PAIRS) { const rows = rowsFor(data, o); assert.ok(checkedCount(rows) > 0 && checkedCount(rows) <= rows.length); }
});
