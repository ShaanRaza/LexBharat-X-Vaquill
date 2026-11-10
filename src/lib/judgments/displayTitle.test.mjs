import { test } from "node:test";
import assert from "node:assert/strict";
import fixture from "../../../scripts/judgments/display-title-fixture.json" with { type: "json" };
import { cleanTitle, displayTitleHits, explainTitle } from "./displayTitle.mjs";

// The same cases as tests/core/test_display_title.py in LexBharat-from-scratch (copied into the shared fixture; every name there is invented).
test("High Court titles are cut to the parties, and the mistakes it once made stay fixed", () => {
  for (const [raw, shown] of fixture.shown) assert.equal(cleanTitle(raw), shown, raw);
});
test("a title with something sensitive left falls back, with the same reason as the Python", () => {
  for (const [raw, reason] of fixture.fallback) assert.deepEqual(explainTitle(raw), [null, reason], raw);
});
test("a value that is not text falls back", () => {
  for (const raw of fixture.not_text) assert.equal(cleanTitle(raw), null);
});
test("every title cleanTitle shows passes the guard's display-title check", () => {
  for (const [, shown] of fixture.shown) if (shown) assert.deepEqual(displayTitleHits(shown), [], shown);
});
