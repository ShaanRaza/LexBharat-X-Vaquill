import test from "node:test";
import assert from "node:assert/strict";
import { gapSentence, gapNotice, gapLead, missingAddendum, unretrievedMentions } from "./gaps.mjs";
import { buildChatPrompt } from "./prompt.mjs";

const NI = "The Negotiable Instruments Act, 1881";
test("the sentence says plainly that the section isn't in the library", () => {
  assert.equal(gapSentence({ kind: "missing", number: "138", actTitle: NI }), "Section 138 of the Negotiable Instruments Act, 1881 isn't in our library yet.");
  assert.match(gapSentence({ kind: "unreliable", number: "9", actTitle: NI }), /not usable.*cannot quote/);
  assert.match(gapSentence({ kind: "mentioned", number: "9", actTitle: NI }), /The answer mentions Section 9 .* isn't in our library yet\./);
});
test("a section above the Act's last one does not exist, which is different from missing", () => {
  assert.equal(gapSentence({ kind: "nosuch", number: "999", actTitle: NI, max: 148 }), "Section 999 of the Negotiable Instruments Act, 1881 doesn't exist: the Act's sections end at 148.");
  assert.match(gapLead([{ kind: "nosuch", number: "999", actTitle: NI, max: 148 }]), /doesn't exist/);
});
test("the notice carries the sentence, the link and a label", () => {
  const n = gapNotice({ kind: "missing", number: "43", actTitle: "The Information Technology Act, 2000" }, "https://indiacode.gov.in/x");
  assert.equal(n.url, "https://indiacode.gov.in/x"); assert.equal(n.label, "Read Section 43 of the Information Technology Act, 2000 on India Code (search for this Act)"); assert.match(n.text, /isn't in our library yet/);
});
test("the lead covers missing and unreliable sections, not mentions", () => {
  assert.equal(gapLead([{ kind: "missing", number: "1", actTitle: "A Act, 2000" }, { kind: "mentioned", number: "2", actTitle: "B Act, 2000" }]), "Section 1 of the A Act, 2000 isn't in our library yet.");
});
test("the prompt forbids answering from memory only when sections are missing", () => {
  const src = [{ n: 1, actTitle: NI, inForce: true, number: "139", heading: "h", text: "x" }];
  assert.ok(!buildChatPrompt({ question: "q", sources: src }).system.includes("Never answer from memory"));
  const sys = buildChatPrompt({ question: "q", sources: src, gaps: [{ kind: "missing", number: "138", actTitle: NI }] }).system;
  assert.match(sys, /Never answer from memory/); assert.match(sys, /Section 138 of the Negotiable Instruments Act, 1881/); assert.ok(sys.includes(missingAddendum([{ kind: "missing", number: "138", actTitle: NI }])));
});
test("unretrievedMentions finds a section named with its Act that no source is", () => {
  const sources = [{ n: 1, number: "138", actTitle: NI }];
  const out = unretrievedMentions("Section 138 of the Negotiable Instruments Act, 1881 gives 30 days [1]. Section 143A of the Negotiable Instruments Act, 1881 allows interim compensation.", sources);
  assert.deepEqual(out.map((m) => m.number), ["143A"]);
  assert.deepEqual(unretrievedMentions("No section is named here.", sources), []);
});
