import { test } from "node:test";
import assert from "node:assert/strict";
import { RAW_ON_PAGE } from "./rules.mjs";

test("programming leftovers are flagged, ordinary legal English is not", () => {
  const r = RAW_ON_PAGE["undefined / null / NaN as text"];
  for (const bad of ["value: null", "Section undefined.", "NaN", "( null )"]) assert.ok(r.test(bad), bad);
  for (const ok of ["Hence illegal, null and void-Constitution", "declared null and void.", "the nullity of marriage"]) assert.ok(!r.test(ok), ok);
});
