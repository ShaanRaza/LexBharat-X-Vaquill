import test from "node:test";
import assert from "node:assert/strict";
import { parseUnitNumber, unitLabel, unitOrd } from "./unitLabel.mjs";

test("unit numbers become words", () => {
  assert.equal(unitLabel("O39R1"), "Order 39 Rule 1");
  assert.equal(unitLabel("O7R10A"), "Order 7 Rule 10A");
  assert.equal(unitLabel("O37"), "Order 37");
  assert.equal(unitLabel("O15A"), "Order 15A");
  assert.equal(unitLabel("A137"), "Article 137");
  assert.equal(unitLabel("A56A"), "Article 56A");
  assert.equal(unitLabel("138"), null);
  assert.equal(unitLabel("11A"), null);
  assert.equal(unitLabel(undefined), null);
});
test("parseUnitNumber", () => {
  assert.deepEqual(parseUnitNumber("O39R2"), { kind: "rule", order: "39", rule: "2" });
  assert.deepEqual(parseUnitNumber("a137"), { kind: "article", article: "137" });
  assert.equal(parseUnitNumber("O"), null);
});
test("units read in order after the sections", () => {
  const a = unitOrd("O1", 100), b = unitOrd("O1R1", 100), c = unitOrd("O1R2", 100), d = unitOrd("O2", 100), e = unitOrd("O1R10A", 100);
  assert.ok(100 < a && a < b && b < c && c < e && e < d);
  assert.ok(unitOrd("A9", 100) < unitOrd("A10", 100));
  assert.equal(unitOrd("12", 100), null);
});

test("Schedules of the Constitution", () => {
  assert.equal(unitLabel("S7"), "Seventh Schedule"); assert.equal(unitLabel("S12"), "Twelfth Schedule"); assert.deepEqual(parseUnitNumber("S1"), { kind: "schedule", schedule: "1" });
  assert.ok(unitOrd("A395", 10) < unitOrd("S1", 10));
});

import { toDisplayBlocks } from "./cleanText.mjs";
test("hand-filled units keep each clause on its own line; dataset text keeps wrapped lines together", () => {
  assert.deepEqual(toDisplayBlocks("(1) First clause\n(2) Second clause").map((b) => b.text), ["(1) First clause (2) Second clause"]);
  assert.deepEqual(toDisplayBlocks("(1) First clause\n(2) Second clause", { lines: true }).map((b) => b.text), ["(1) First clause", "(2) Second clause"]);
  assert.deepEqual(toDisplayBlocks("One paragraph\nwrapped.\n\nNext.").map((b) => b.text), ["One paragraph wrapped.", "Next."]);
});

test("the Preamble is a unit that comes before Article 1", () => {
  assert.equal(unitLabel("PREAMBLE"), "Preamble"); assert.equal(unitLabel("Preamble"), "Preamble"); assert.ok(unitOrd("PREAMBLE", 0) < unitOrd("A1", 0));
});
