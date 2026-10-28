import test from "node:test";
import assert from "node:assert/strict";
import { AREAS, WORK_TABS, areaOf, isReadingPage, workTabOf } from "./areas.mjs";
import { SHORTCUTS, groupOrder, looksLikeCaseName, looksLikeCitation, matchShortcuts, matchWork, topResult } from "./quickfind.mjs";

test("every page of the app belongs to one area, and public pages to none", () => {
  const want = { "/": "desk", "/ask": "ask", "/ask/abc": "ask", "/search": "search", "/library": "library", "/library/judgments/supreme-court-of-india": "library", "/law/IND_central_2189": "library", "/law/IND_central_2189/s138": "library",
    "/judgments/supreme-court-of-india/2014/2014_INSC_514": "library", "/work/drafts": "work", "/work/drafts/x": "work", "/work/reviews": "work", "/work/vault": "work", "/work/vault/id": "work", "/admin": null, "/privacy": null, "/access": null, "/nope": null };
  for (const [p, a] of Object.entries(want)) assert.equal(areaOf(p), a, p);
  assert.equal(areaOf("/library/"), "library"); assert.equal(areaOf(""), "desk");
});
test("the five areas are the spec's, in order, and Work has Drafts, Reviews, Documents", () => {
  assert.deepEqual(AREAS.map((a) => a.label), ["Desk", "Ask", "Search", "Library", "Work"]);
  assert.deepEqual(WORK_TABS.map((t) => t.label), ["Drafts", "Reviews", "Vault"]);
  assert.equal(workTabOf("/work/reviews/abc"), "reviews"); assert.equal(workTabOf("/work/vault"), "vault"); assert.equal(workTabOf("/work/vault/abc"), "vault"); assert.equal(workTabOf("/ask"), null);
});
test("only a law or a judgment is a reading page", () => {
  assert.equal(isReadingPage("/law/IND_central_2189"), true); assert.equal(isReadingPage("/law/IND_central_2189/s138"), true); assert.equal(isReadingPage("/judgments/bombay-high-court/2020/X"), true);
  for (const p of ["/library", "/ask", "/library/judgments/bombay-high-court", "/work/vault", "/"]) assert.equal(isReadingPage(p), false, p);
});
test("citations and case names are told apart; groups are ordered accordingly", () => {
  for (const q of ["138 NI Act", "section 138 of the NI Act", "Order 7 Rule 11", "O.39 R.1 CPC", "Article 21", "art. 226"]) assert.equal(looksLikeCitation(q), true, q);
  for (const q of ["cheque bounce notice", "what is bail", "138", "NI Act"]) assert.equal(looksLikeCitation(q), false, q);
  for (const q of ["State of UP v. Kumar", "Joshi vs Patil", "A versus B"]) assert.equal(looksLikeCaseName(q), true, q);
  assert.equal(looksLikeCaseName("overview of bail"), false);
  assert.deepEqual(groupOrder("State v. Kumar"), ["judgments", "laws", "mentions", "work"]); assert.deepEqual(groupOrder("138 NI Act"), ["go", "laws", "mentions", "judgments", "work"]); assert.deepEqual(groupOrder("138", true), ["go", "laws", "mentions", "judgments", "work"]); assert.deepEqual(groupOrder("bail"), ["go", "laws", "mentions", "judgments", "work"]);
});
test("your own work matches on every word, best first, and Enter opens the first result of the first group", () => {
  const items = [{ title: "Legal notice: cheque dishonour", updatedAt: "2026-10-27" }, { title: "NDA review", updatedAt: "2026-10-28" }, { title: "Cheque bounce question", updatedAt: "2026-10-20" }, { title: "Rent agreement", updatedAt: "2026-10-01" }];
  assert.deepEqual(matchWork(items, "cheque").map((x) => x.title), ["Cheque bounce question", "Legal notice: cheque dishonour"]);
  assert.deepEqual(matchWork(items, "cheque notice").map((x) => x.title), ["Legal notice: cheque dishonour"]); assert.deepEqual(matchWork(items, ""), []); assert.equal(matchWork(items, "cheque", 1).length, 1);
  assert.deepEqual(topResult({ laws: [], judgments: [{ id: 1 }], work: [{ id: 2 }] }, ["laws", "judgments", "work"]), { group: "judgments", item: { id: 1 } }); assert.equal(topResult({}, ["laws"]), null);
});

test("typing vault, review or draft (or the start of one) points at that page, and a page switched off is left out", () => {
  const all = ["drafting", "review", "vault"];
  assert.deepEqual(matchShortcuts("vault", all).map((s) => s.id), ["vault"]); assert.deepEqual(matchShortcuts("va", all).map((s) => s.id), ["vault"]); assert.deepEqual(matchShortcuts("Vault", all).map((s) => s.id), ["vault"]);
  assert.deepEqual(matchShortcuts("review", all).map((s) => s.id), ["reviews"]); assert.deepEqual(matchShortcuts("reviews", all).map((s) => s.id), ["reviews"]); assert.deepEqual(matchShortcuts("rev", all).map((s) => s.id), ["reviews"]);
  assert.deepEqual(matchShortcuts("draft", all).map((s) => s.id), ["drafts"]); assert.deepEqual(matchShortcuts("drafting", all).map((s) => s.id), ["drafts"]); assert.deepEqual(matchShortcuts("dr", all).map((s) => s.id), ["drafts"]);
  assert.deepEqual(matchShortcuts("documents", all).map((s) => s.id), ["vault"]);
  for (const q of ["", "v", "138", "cheque", "vault review", "banana"]) assert.deepEqual(matchShortcuts(q, all), [], q);
  assert.deepEqual(matchShortcuts("review", ["drafting", "vault"]), []);   // Review switched off: not offered
  assert.deepEqual(SHORTCUTS.map((s) => s.label), ["Drafts", "Reviews", "Vault"]);
});

import fs from "node:fs";
import { classifyDesk, deskHint } from "./desk.mjs";
const qcfg = JSON.parse(fs.readFileSync(new URL("../../config/quickfind.json", import.meta.url), "utf8")), dcfg = JSON.parse(fs.readFileSync(new URL("../../config/desk.json", import.meta.url), "utf8"));
test("Desk's box: a question asks, a citation opens the law, a case name opens the judgment, anything unclear searches", () => {
  const kind = (q) => classifyDesk(q, qcfg).kind;
  for (const q of ["138 NI Act", "138", "s.138 NI", "NI 138", "Order 7 Rule 11", "Article 21", "O.39 R.1 CPC", "43A"]) assert.equal(kind(q), "law", q);
  for (const q of ["State of UP v. Kumar", "Joshi vs Patil", "Dashrath Rupsingh Rathod versus State of Maharashtra"]) assert.equal(kind(q), "case", q);
  for (const q of ["What is the notice period for cheque bounce?", "can a minor enter into a contract", "how long to file a cheque bounce complaint", "Is a verbal agreement valid", "the limitation period for a recovery suit under the Act"]) assert.equal(kind(q), "ask", q);
  for (const q of ["cheque bounce", "bail", "double cheque bounces", "Companies Act", "notice period"]) assert.equal(kind(q), "search", q);   // unsure: search
  assert.equal(kind(""), "empty"); assert.equal(kind("   "), "empty");
});
test("the line under Desk's box says what Enter will do, in every state", () => {
  assert.equal(deskHint("empty", "", null, dcfg), dcfg.emptyHint); assert.match(deskHint("ask", "q", null, dcfg), /opens Ask/);
  assert.equal(deskHint("law", "138 NI", { title: "Section 138 · The Negotiable Instruments Act, 1881" }, dcfg), "Enter opens Section 138 · The Negotiable Instruments Act, 1881.");
  assert.match(deskHint("law", "138 zz", null, dcfg), /searches if there is no match/); assert.match(deskHint("case", "A v. B", { title: "A v. B" }, dcfg), /opens the judgment: A v\. B/); assert.match(deskHint("case", "State v. Kumar", null, dcfg), /searches the judgments for “State v\. Kumar”/);
  assert.match(deskHint("search", "  cheque   bounce ", null, dcfg), /searches the Acts for “cheque bounce”/);
  assert.ok(dcfg.chips.length >= 3 && dcfg.chips.every((c) => c.text)); assert.ok(dcfg.coverage.includes("High Court") && dcfg.tagline.includes("traced to the page"));
});
