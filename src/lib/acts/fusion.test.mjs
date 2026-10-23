import test from "node:test";
import assert from "node:assert/strict";
import { rrf, dedupe, firstHitRank, hitRates, truncateNormalize } from "./fusion.mjs";

test("rrf: an item high in both lists beats items high in one", () => {
  assert.deepEqual(rrf([["a", "b", "c"], ["c", "a", "d"]]).slice(0, 2), ["a", "c"]);
  assert.deepEqual(rrf([["x"], []]), ["x"]); assert.deepEqual(rrf([]), []);
});
test("rrf is deterministic on ties", () => { assert.deepEqual(rrf([["b"], ["a"]]), ["a", "b"]); });
test("dedupe keeps first occurrences; firstHitRank and hitRates", () => {
  assert.deepEqual(dedupe(["a", "b", "a", "c"]), ["a", "b", "c"]);
  assert.equal(firstHitRank(["a", "b", "c"], new Set(["c"])), 3); assert.equal(firstHitRank(["a"], new Set(["z"])), null);
  assert.deepEqual(hitRates([1, 4, null, 12], [1, 5, 10]), { 1: 0.25, 5: 0.5, 10: 0.5 });
});
test("truncateNormalize gives a unit vector of the requested size", () => {
  const t = truncateNormalize([3, 4, 12], 2); assert.equal(t.length, 2); assert.ok(Math.abs(t[0] - 0.6) < 1e-9 && Math.abs(t[1] - 0.8) < 1e-9);
});
