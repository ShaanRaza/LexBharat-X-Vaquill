import test from "node:test";
import assert from "node:assert/strict";
import { findMentions, mentionLabel, romanToInt, segments } from "./statuteLinks.mjs";

const found = (t, y = 2000) => findMentions(t, y).map((m) => `${m.actKey}:${m.number}`);

test("section mentions, in the forms judgments use", () => {
  assert.deepEqual(found("convicted under Section 302 of the Indian Penal Code and s. 34 IPC."), ["ipc:302", "ipc:34"]);
  assert.deepEqual(found("Indian Penal Code, ss. 302, 34 — Evidence Act, s. 27"), ["ipc:302", "ipc:34", "evidence:27"]);
  assert.deepEqual(found("s. 138 of the Negotiable Instruments Act, 1881 and Section 143 of the N.I. Act"), ["ni:138", "ni:143"]);
  assert.deepEqual(found("section 138 BNS and Section 482 of the Code of Criminal Procedure"), ["bns:138", "crpc:482"]);
  assert.deepEqual(found("Section 10 of the Indian Contract Act, 1872"), ["contract:10"]);
  assert.deepEqual(found("Penal Code,1860 – ss.302,364 and 34"), ["ipc:302", "ipc:364", "ipc:34"]);
  assert.deepEqual(found("Ranbir Penal Code – ss.302"), [], "no year, so not the IPC");
});
test("a number with no Act named is never a mention", () => {
  assert.deepEqual(found("Section 302 alone and section 5 of the Act"), []);
  assert.deepEqual(found("s. 27 of the Bankers' Books Evidence Act"), []);
  assert.deepEqual(found("paragraph 12 of the order dated 5 May"), []);
});
test("Orders and Rules, with Roman numerals", () => {
  assert.deepEqual(found("Order 39 Rule 1 CPC"), ["cpc:O39R1"]);
  assert.deepEqual(found("O. XXXIX, r. 1 and 2 of the Code of Civil Procedure"), ["cpc:O39R1", "cpc:O39R2"]);
  assert.deepEqual(found("Order 21 Rules 1 to 3 of the CPC"), ["cpc:O21R1", "cpc:O21R2", "cpc:O21R3"]);
  assert.deepEqual(found("Order 37 of the CPC"), ["cpc:O37"]);
  assert.deepEqual(found("Code of Civil Procedure, 1908 - s. 11 and Or. 7 r.11 (d) - Rejection"), ["cpc:11", "cpc:O7R11"]);
  assert.deepEqual(found("Order 39 Rule 1 was invoked"), [], "no CPC in the text: not linked");
  assert.deepEqual(found("Order VII Rule 11 ... under the Code of Civil Procedure"), ["cpc:O7R11"]);
  assert.equal(romanToInt("XXXIX"), 39);
});
test("Articles: Limitation and Stamp Act get numbers; the Constitution is recognised", () => {
  assert.deepEqual(found("Article 137 of the Limitation Act, 1963", 1990), ["limitation:A137"]);
  assert.deepEqual(found("Article 21 of the Constitution of India"), ["constitution:21"]);
  assert.deepEqual(found("Constitution of India, Arts. 19(1)(g), 31"), ["constitution:19", "constitution:31"]);
});
test("a name that meant an older Act is not linked", () => {
  assert.deepEqual(found("Section 11 of the Arbitration Act", 1955), []);
  assert.deepEqual(found("Section 11 of the Arbitration Act", 2010), ["arbitration:11"]);
  assert.deepEqual(found("Section 11 of the Arbitration and Conciliation Act", 2010), ["arbitration:11"]);
  assert.deepEqual(found("Article 54 of the Limitation Act", 1955), []);
  assert.deepEqual(found("Article 54 of the Limitation Act, 1963", 1955), ["limitation:A54"]);
});
test("segments and labels", () => {
  const t = "under s. 302 of the IPC.";
  const parts = segments(t, findMentions(t, 1990));
  assert.deepEqual(parts.map((p) => p.text), ["under s. ", "302", " of the IPC."]);
  assert.equal(mentionLabel(findMentions(t, 1990)[0]), "Section 302");
  assert.equal(mentionLabel({ kind: "rule", number: "O39R1" }), "Order 39 Rule 1");
  assert.equal(mentionLabel({ kind: "article", number: "A137" }), "Article 137");
});
