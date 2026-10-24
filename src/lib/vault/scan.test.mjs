import test from "node:test";
import assert from "node:assert/strict";
import { mergePages, parseScanOutput, planScan, scanPrompt } from "./scan.mjs";

test("the model's reply is split back into pages", () => {
  const r = parseScanOutput("=== PAGE 1 ===\nThis Agreement is made on 5 May 2026.\n\n1. Term\nOne year.\n=== PAGE 2 ===\n[blank page]\n=== PAGE 3 ===\nकिराया पाँच हज़ार रुपये है।", 3);
  assert.equal(r[0], "This Agreement is made on 5 May 2026.\n\n1. Term\nOne year.");
  assert.equal(r[1], "");
  assert.equal(r[2], "किराया पाँच हज़ार रुपये है।");
});
test("a page the model left out is null; a stray marker is ignored", () => {
  assert.deepEqual(parseScanOutput("=== PAGE 1 ===\nA\n=== PAGE 3 ===\nC", 3), ["A", null, "C"]);
  assert.deepEqual(parseScanOutput("=== PAGE 7 ===\nZ", 2), [null, null]);
  assert.deepEqual(parseScanOutput("", 2), [null, null]);
  assert.deepEqual(parseScanOutput("Just the text, no marker", 1), ["Just the text, no marker"]);
});
test("the limit keeps the first pages and counts the rest", () => {
  assert.deepEqual(planScan([1, 2, 3, 5, 8], 3), { take: [1, 2, 3], skipped: 2 });
  assert.deepEqual(planScan([4], 20), { take: [4], skipped: 0 });
});
test("text pages and read pages are merged by page number", () => {
  assert.deepEqual(mergePages(["text one", "", "text three"], new Map([[2, "from scan"]])), ["text one", "from scan", "text three"]);
  assert.deepEqual(mergePages(["a", ""], new Map()), ["a", ""]);
});
test("the prompt names the page count and keeps the original script", () => {
  assert.match(scanPrompt(3), /3 pages/); assert.match(scanPrompt(1), /1 page,/); assert.match(scanPrompt(2), /Do not translate/);
});

import { annotateClauses, clausePage, locate } from "../review/pages.mjs";
test("a clause's page comes from where its quote sits; scan pages are marked", () => {
  const text = "Page one text.\n\nClause 1 here.\n\nPage two text.\n\nNon-compete for five years.", starts = [0, 28];
  const part = { start: 0, end: text.length };
  assert.equal(clausePage(text, part, "Non-compete for five years.", starts), 2);
  assert.equal(clausePage(text, part, "Clause 1 here.", starts), 1);
  assert.equal(clausePage(text, part, "x", null), null);
  const [a, b] = annotateClauses([{ quote: "Clause 1 here." }, { quote: "Non-compete for five years." }], text, part, starts, [2]);
  assert.equal(a.scan, undefined); assert.equal(b.scan, true); assert.equal(b.page, 2);
});
test("a quote is found even when the page breaks its lines differently", () => {
  assert.equal(locate("Alpha\n  Beta   gamma\ndelta", "beta gamma delta"), 8);
  assert.equal(locate("abc", "zzz"), -1); assert.equal(locate("abc", ""), -1);
  assert.equal(clausePage("Page one.\n\nPage two has the non-\ncompete clause.", { start: 0, end: 60 }, "Page two has the non- compete clause.", [0, 11]), 2);
});
