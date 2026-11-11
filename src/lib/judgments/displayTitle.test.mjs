import { test } from "node:test";
import assert from "node:assert/strict";
import fixture from "../../../scripts/judgments/display-title-fixture.json" with { type: "json" };
import { cleanTitle, explainTitle, exportTitle, titleHits } from "./displayTitle.ts";

// The shared title cases: the same cases as tests/core/test_display_title.py in LexBharat-from-scratch (every name there is invented).
test("every shared case gives the same title and reason as the Python", () => {
  for (const c of fixture.cases) {
    const [shown, reason] = explainTitle(c.raw, c.court_type);
    assert.equal(shown, c.expected, `${c.court_type}: ${JSON.stringify(c.raw)}`);
    if (c.reason !== null) assert.equal(reason, c.reason, `${c.court_type}: ${JSON.stringify(c.raw)}`);
  }
  assert.ok(fixture.cases.length >= 80);
});
test("cleanTitle is the High Court rule", () => {
  for (const c of fixture.cases.filter((x) => x.court_type === "high_court")) assert.equal(cleanTitle(c.raw), c.expected);
});
test("every High Court title the rule shows passes the guard's title check", () => {
  for (const c of fixture.cases) if (c.court_type === "high_court" && c.expected) assert.deepEqual(titleHits(c.expected), [], c.expected);
});
test("the guard's title check fails an uncleaned source title", () => {
  assert.deepEqual(titleHits("WP/12/2024 of TESTA FAKENAME Vs STATE"), ["not cleaned (registration prefix or None left)"]);
});
test("exportTitle: the Python rule, then the in-jail and guard fallbacks (invented names)", () => {
  for (const c of fixture.cases.filter((x) => x.court_type === "high_court")) assert.equal(exportTitle(c.raw)[0], c.expected);   // nothing in the shared cases changes
  assert.deepEqual(exportTitle("CRA/5/2017 of TESTA FAKENAME (IN JAIL) Vs STATE"), [null, "in_jail"]);
  assert.deepEqual(exportTitle("CWJC/9/2017 of In The Matter Of Letter Dated 12/07/2017 Of Mr. Testa Fakename Vs The State"), [null, "guard_check"]);
  assert.deepEqual(exportTitle("WP/12/2024 of TESTA FAKENAME Vs STATE"), ["TESTA FAKENAME Vs STATE", "ok"]);
});
