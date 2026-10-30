import { test } from "node:test";
import assert from "node:assert/strict";
import { RAW_ON_PAGE } from "./rules.mjs";

test("programming leftovers are flagged, ordinary legal English is not", () => {
  const r = RAW_ON_PAGE["undefined / null / NaN as text"];
  for (const bad of ["value: null", "Section undefined.", "NaN", "( null )"]) assert.ok(r.test(bad), bad);
  for (const ok of ["Hence illegal, null and void-Constitution", "declared null and void.", "the nullity of marriage"]) assert.ok(!r.test(ok), ok);
});

test("a heading run into its text, and the builder's placeholder, are flagged; a real dash inside a title is not", () => {
  assert.ok(RAW_ON_PAGE["a heading run into the start of its text (\" . \u2014 ...\")"].test("Rioting . \u2014 Whenever force or violence"));
  assert.ok(RAW_ON_PAGE["a data placeholder shown as text: (no heading in our data)"].test("CrPC 267 (no heading in our data)"));
  assert.ok(!RAW_ON_PAGE["a heading run into the start of its text (\" . \u2014 ...\")"].test("Abetment of offence punishable with imprisonment\u2014if offence be not committed"));
});
