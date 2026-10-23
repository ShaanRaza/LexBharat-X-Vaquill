import test from "node:test";
import assert from "node:assert/strict";
import { findGaps, maxCitedSection, robustMax, startsWithOwnNumber } from "./gaps.mjs";

test("findGaps: an isolated gap in an otherwise complete Act is confident", () => {
  const nums = Array.from({ length: 100 }, (_, i) => String(i + 1)).filter((n) => !["16", "73"].includes(n)).concat(["19A"]);
  const g = findGaps(nums);
  assert.equal(g.expectedMax, 100); assert.deepEqual(g.missing, [16, 73]); assert.deepEqual(g.confident, [16, 73]); assert.equal(g.uncertain.length, 0); assert.equal(g.severe, false);
});
test("findGaps: a sparse Act is not confident and is marked severe", () => {
  const g = findGaps(["1", "2", "3"], 160);
  assert.equal(g.expectedMax, 160); assert.equal(g.severe, true); assert.equal(g.confident.length, 0); assert.equal(g.uncertain.length, 157);
});
test("findGaps: a long run is uncertain even in a dense Act", () => {
  const nums = Array.from({ length: 200 }, (_, i) => i + 1).filter((n) => n < 50 || n > 59).map(String);
  const g = findGaps(nums); assert.equal(g.confident.length, 0); assert.equal(g.uncertain.length, 10);
});
test("findGaps: letters, empty input and the citation bound", () => {
  assert.deepEqual(findGaps([]).missing, []); assert.deepEqual(findGaps(["1", "2A", "3"]).missing, []);
  assert.equal(maxCitedSection(["see section 135 and section 12A of this Act", "section 9 of the Indian Penal Code, 1860", "sections 77"], 100), 135);
  assert.equal(maxCitedSection(["as amended up to section 1950 and section 5000, section 40"], 30), 40, "years and implausible numbers are ignored");
});
test("startsWithOwnNumber", () => {
  assert.equal(startsWithOwnNumber("138", "**138. Dishonour of cheque.—** Where any cheque"), true);
  assert.equal(startsWithOwnNumber("11", "**12. Something else.—**"), false);
  assert.equal(startsWithOwnNumber("11", "the text has no number"), null); assert.equal(startsWithOwnNumber("11", ""), null);
});

test("robustMax ignores an isolated straggler number", () => {
  assert.equal(robustMax([1, 2, 3, 4, 5, 6, 1161]), 6);
  assert.equal(findGaps(["1", "2", "3", "4", "5", "7", "1161"]).expectedMax, 7);
  assert.equal(robustMax([]), 0); assert.equal(robustMax([9]), 9);
});

test("a reference count caps the expected maximum", () => {
  const nums = Array.from({ length: 262 }, (_, i) => String(i + 1)).filter((n) => !["8", "9"].includes(n));
  assert.equal(findGaps(nums).expectedMax, 262);
  const g = findGaps(nums, 0, 148); assert.equal(g.expectedMax, 148); assert.deepEqual(g.confident, [8, 9]);
});
