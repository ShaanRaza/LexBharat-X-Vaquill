import test from "node:test";
import assert from "node:assert/strict";
import { AREAS, WORK_TABS, areaOf, isReadingPage, workTabOf } from "./areas.mjs";
import { groupOrder, looksLikeCaseName, looksLikeCitation, matchWork, topResult } from "./quickfind.mjs";

test("every page of today's app belongs to one area, and public pages to none", () => {
  const want = { "/workspace": "desk", "/workspace/chat": "ask", "/workspace/chat/abc": "ask", "/workspace/browse": "library", "/workspace/browse/acts/IND_central_2189": "library", "/workspace/browse/judgments/supreme-court-of-india/2014/2014_INSC_514": "library",
    "/workspace/drafting": "work", "/workspace/drafting/x": "work", "/workspace/review": "work", "/workspace/vault": "work", "/workspace/vault/id": "work", "/privacy": null, "/access": null, "/nope": null };
  for (const [p, a] of Object.entries(want)) assert.equal(areaOf(p), a, p);
  assert.equal(areaOf("/workspace/browse", "?tab=acts"), "search"); assert.equal(areaOf("/workspace/browse/", ""), "library"); assert.equal(areaOf("/workspace/"), "desk");
});
test("the five areas are the spec's, in order, and Work has Drafts, Reviews, Documents", () => {
  assert.deepEqual(AREAS.map((a) => a.label), ["Desk", "Ask", "Search", "Library", "Work"]);
  assert.deepEqual(WORK_TABS.map((t) => t.label), ["Drafts", "Reviews", "Documents"]);
  assert.equal(workTabOf("/workspace/review/abc"), "reviews"); assert.equal(workTabOf("/workspace/vault"), "documents"); assert.equal(workTabOf("/workspace/chat"), null);
});
test("only a law or a judgment is a reading page", () => {
  assert.equal(isReadingPage("/workspace/browse/acts/IND_central_2189"), true); assert.equal(isReadingPage("/workspace/browse/judgments/bombay-high-court/2020/X"), true);
  for (const p of ["/workspace/browse", "/workspace/chat", "/workspace/browse/judgments/bombay-high-court", "/workspace/vault"]) assert.equal(isReadingPage(p), false, p);
});
test("citations and case names are told apart; groups are ordered accordingly", () => {
  for (const q of ["138 NI Act", "section 138 of the NI Act", "Order 7 Rule 11", "O.39 R.1 CPC", "Article 21", "art. 226"]) assert.equal(looksLikeCitation(q), true, q);
  for (const q of ["cheque bounce notice", "what is bail", "138", "NI Act"]) assert.equal(looksLikeCitation(q), false, q);
  for (const q of ["State of UP v. Kumar", "Joshi vs Patil", "A versus B"]) assert.equal(looksLikeCaseName(q), true, q);
  assert.equal(looksLikeCaseName("overview of bail"), false);
  assert.deepEqual(groupOrder("State v. Kumar"), ["judgments", "laws", "work"]); assert.deepEqual(groupOrder("138 NI Act"), ["laws", "judgments", "work"]); assert.deepEqual(groupOrder("bail"), ["laws", "judgments", "work"]);
});
test("your own work matches on every word, best first, and Enter opens the first result of the first group", () => {
  const items = [{ title: "Legal notice: cheque dishonour", updatedAt: "2026-10-27" }, { title: "NDA review", updatedAt: "2026-10-28" }, { title: "Cheque bounce question", updatedAt: "2026-10-20" }, { title: "Rent agreement", updatedAt: "2026-10-01" }];
  assert.deepEqual(matchWork(items, "cheque").map((x) => x.title), ["Cheque bounce question", "Legal notice: cheque dishonour"]);
  assert.deepEqual(matchWork(items, "cheque notice").map((x) => x.title), ["Legal notice: cheque dishonour"]); assert.deepEqual(matchWork(items, ""), []); assert.equal(matchWork(items, "cheque", 1).length, 1);
  assert.deepEqual(topResult({ laws: [], judgments: [{ id: 1 }], work: [{ id: 2 }] }, ["laws", "judgments", "work"]), { group: "judgments", item: { id: 1 } }); assert.equal(topResult({}, ["laws"]), null);
});
