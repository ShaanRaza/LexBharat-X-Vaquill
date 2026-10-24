import test from "node:test";
import assert from "node:assert/strict";
import { articleRow, buildScheduleTable, tableKindOf } from "./scheduleTable.mjs";

const A137 = "Description of suit: Any other application for which no period of limitation is provided elsewhere in this Division.\nPeriod of limitation: Three years.\nTime from which period begins to run: When the right to apply accrues.\nTHIRD DIVISION—APPLICATIONS\nPART II—OTHER APPLICATION";
test("a Limitation Article becomes a table row", () => {
  const r = articleRow("A137", A137);
  assert.equal(r.article, "137"); assert.equal(r.kind, "limitation");
  assert.deepEqual(r.cells, ["Any other application for which no period of limitation is provided elsewhere in this Division.", "Three years.", "When the right to apply accrues."]);
  assert.equal(r.group, "THIRD DIVISION—APPLICATIONS · PART II—OTHER APPLICATION");
});
test("not a table row", () => {
  assert.equal(articleRow("138", A137), null);
  assert.equal(articleRow("A5", "Some text"), null);
  assert.equal(tableKindOf("Description of instrument: BOND"), "stamp");
});
test("rows are sorted by article and mark where the group changes", () => {
  const mk = (n, g) => ({ number: n, body: `Description of suit: x\nPeriod of limitation: y\nTime from which period begins to run: z${g ? `\n${g}` : ""}` });
  const t = buildScheduleTable([mk("A10", "D2"), mk("A2", "D1"), mk("A2A", "D1"), mk("A9", "D1")]);
  assert.deepEqual(t.rows.map((r) => r.article), ["2", "2A", "9", "10"]);
  assert.deepEqual(t.rows.map((r) => r.startsGroup), [true, false, false, true]);
  assert.equal(t.columns.length, 4);
});

test("Articles the PDF does not print get their own row, in place", () => {
  const mk = (n) => ({ number: n, body: "Description of instrument: BOND\nProper stamp-duty: Two annas." });
  const t = buildScheduleTable([mk("A5"), mk("A22")], { numbers: [21, 4], note: "Not printed in the source PDF — check India Code." });
  assert.deepEqual(t.rows.map((r) => r.article), ["4", "5", "21", "22"]);
  assert.equal(t.rows[0].notPrinted, true); assert.equal(t.rows[0].cells[0], "Not printed in the source PDF — check India Code."); assert.equal(t.rows[1].notPrinted, undefined);
});
