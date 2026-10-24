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
