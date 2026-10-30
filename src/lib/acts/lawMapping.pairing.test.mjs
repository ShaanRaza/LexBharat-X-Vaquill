import test from "node:test";
import assert from "node:assert/strict";
import data from "../../config/law-mapping.json" with { type: "json" };
import { baseNumber } from "./lawMapping.mjs";

// The two facts per row (README-law-mapping.md): pairing_confirmed (both Government documents agree) and linkable (both sections in our data and titles correspond). verified = both.
test("a verified row has both facts, both documents, and both texts in our data", () => {
  for (const r of data.rows.filter((x) => x.status === "verified")) {
    const id = `${r.old_law} ${r.old_section}`;
    assert.equal(r.pairing_confirmed, true, id); assert.equal(r.linkable, true, id);
    assert.deepEqual([...(r.tables ?? [])].sort(), ["capt", "ncrb"], id);
    assert.equal(r.old_text_in_data, true, id); assert.equal(r.new_text_in_data, true, id);
  }
});
test("the page's in-data flags agree with the facts: a link needs the text to be in our data, and a linkable row is linkable on both sides", () => {
  for (const r of data.rows) {
    const id = `${r.old_law} ${r.old_section}`;
    if (r.old_in_data === true) assert.equal(r.old_text_in_data, true, id);
    if (r.new_in_data === true) assert.equal(r.new_text_in_data, true, id);
    if (r.linkable === true) assert.deepEqual([r.old_in_data, r.new_in_data], [true, true], id);
  }
});
test("a row only one document lists is never confirmed and never verified", () => {
  for (const r of data.rows.filter((x) => (x.tables ?? []).length < 2)) { assert.notEqual(r.pairing_confirmed, true, `${r.old_law} ${r.old_section}`); assert.notEqual(r.status, "verified", `${r.old_law} ${r.old_section}`); }
});
test("a missing section stays a confirmed pairing, and says its text is not in our data", () => {
  const r = data.rows.find((x) => x.old_law === "ipc" && x.old_section === "34");
  assert.equal(r.pairing_confirmed, true); assert.equal(r.old_text_in_data, false); assert.equal(r.status, "unverified"); assert.equal(baseNumber(r.new_section), "3");
});
test("known pairings from the Government tables", () => {
  const find = (o, s) => data.rows.find((x) => x.old_law === o && x.old_section === s);
  for (const [o, s, n] of [["ipc", "302", "103"], ["ipc", "304B", "80"], ["ipc", "304A", "106"], ["ipc", "376", "64"], ["ipc", "498A", "85"], ["ipc", "379", "303"], ["ipc", "406", "316"], ["crpc", "154", "173"], ["crpc", "438", "482"], ["evidence", "65B", "63"]]) {
    const r = find(o, s); assert.ok(r, `${o} ${s}`); assert.equal(baseNumber(r.new_section), n, `${o} ${s}`); assert.equal(r.pairing_confirmed, true, `${o} ${s}`);
  }
});
test("also_new_sections entries are complete", () => {
  for (const r of data.rows.filter((x) => x.also_new_sections)) for (const a of r.also_new_sections) { assert.ok(a.new_section && a.new_title, r.old_section); assert.equal(typeof a.pairing_confirmed, "boolean"); assert.ok(Array.isArray(a.tables)); }
});
