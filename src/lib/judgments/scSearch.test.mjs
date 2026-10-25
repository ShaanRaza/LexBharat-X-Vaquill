import test from "node:test";
import assert from "node:assert/strict";
import { phraseIn, termCounts, snippetAround } from "./scSearch.mjs";

test("phrases are matched ignoring case and spacing", () => {
  assert.ok(phraseIn("The doctrine of  Res\nJudicata applies.", "res judicata"));
  assert.ok(!phraseIn("res and judicata", "res judicata"));
});
test("term counts are per 10,000 characters", () => {
  const a = termCounts("cheque cheque x", ["cheque"]), b = termCounts("cheque " + "x".repeat(9993), ["cheque"]);
  assert.equal(a.count, 2);
  assert.ok(Math.abs(b.perTenK - 1) < 0.01);
});
test("snippet starts in the chunk that holds the first term and marks it", () => {
  const s = snippetAround([{ i: 0, ps: 1, t: "nothing here" }, { i: 1, ps: 2, t: "the limitation period under section 138 begins" }], ["limitation"]);
  assert.equal(s.chunk, 1); assert.equal(s.page, 2); assert.ok(s.text.includes("limitation"));
});
