import test from "node:test";
import assert from "node:assert/strict";
import { gapSentence, gapNotice, gapLead, missingAddendum, unretrievedMentions, uniqueGaps, dropGapRepeats } from "./gaps.mjs";
import { shortActName } from "../docs/docType.mjs";
import { buildChatPrompt } from "./prompt.mjs";

const NI = "The Negotiable Instruments Act, 1881";
test("the sentence says plainly that the section isn't in the library", () => {
  assert.equal(gapSentence({ kind: "missing", number: "138", actTitle: NI }), "Section 138 of the Negotiable Instruments Act isn't in our library yet.");
  assert.match(gapSentence({ kind: "unreliable", number: "9", actTitle: NI }), /not usable.*cannot quote/);
  assert.match(gapSentence({ kind: "mentioned", number: "9", actTitle: NI }), /The answer mentions Section 9 .* isn't in our library yet\./);
});
test("a section above the Act's last one does not exist, which is different from missing", () => {
  assert.equal(gapSentence({ kind: "nosuch", number: "999", actTitle: NI, max: 148 }), "Section 999 of the Negotiable Instruments Act doesn't exist: the Act's sections end at 148.");
  assert.match(gapLead([{ kind: "nosuch", number: "999", actTitle: NI, max: 148 }]), /doesn't exist/);
});
test("the notice carries the sentence, the link and a label", () => {
  const n = gapNotice({ kind: "missing", number: "43", actTitle: "The Information Technology Act, 2000" }, "https://indiacode.gov.in/x");
  assert.equal(n.url, "https://indiacode.gov.in/x"); assert.equal(n.label, "Read Section 43 of the Information Technology Act on India Code (search for this Act)"); assert.match(n.text, /isn't in our library yet/);
});
test("the lead covers missing and unreliable sections, not mentions", () => {
  assert.equal(gapLead([{ kind: "missing", number: "1", actTitle: "A Act, 2000" }, { kind: "mentioned", number: "2", actTitle: "B Act, 2000" }]), "Section 1 of the A Act isn't in our library yet.");
});
test("the prompt forbids answering from memory only when sections are missing", () => {
  const src = [{ n: 1, actTitle: NI, inForce: true, number: "139", heading: "h", text: "x" }];
  assert.ok(!buildChatPrompt({ question: "q", sources: src }).system.includes("Never answer from memory"));
  const sys = buildChatPrompt({ question: "q", sources: src, gaps: [{ kind: "missing", number: "138", actTitle: NI }] }).system;
  assert.match(sys, /Never answer from memory/); assert.match(sys, /Section 138 of the Negotiable Instruments Act/); assert.ok(sys.includes(missingAddendum([{ kind: "missing", number: "138", actTitle: NI }])));
});
test("unretrievedMentions finds a section named with its Act that no source is", () => {
  const sources = [{ n: 1, number: "138", actTitle: NI }];
  const out = unretrievedMentions("Section 138 of the Negotiable Instruments Act, 1881 gives 30 days [1]. Section 143A of the Negotiable Instruments Act, 1881 allows interim compensation.", sources);
  assert.deepEqual(out.map((m) => m.number), ["143A"]);
  assert.deepEqual(unretrievedMentions("No section is named here.", sources), []);
});

const IPC = "The Indian Penal Code, 45 of 1860 (Rep., Act 45 of 2023)";
test("the short Act name: no The, year, number or repeal note; the full title stays in the notice for the hover text", () => {
  assert.equal(shortActName(IPC), "Indian Penal Code");
  assert.equal(shortActName("The Negotiable Instruments Act, 1881"), "Negotiable Instruments Act");
  assert.equal(shortActName("The Motor Vehicles Act, 1988 (59 of 1988)"), "Motor Vehicles Act");
  assert.equal(shortActName("The Indian Evidence Act, 1 of 1872"), "Indian Evidence Act");
  assert.equal(shortActName("Manipur Land Revenue and Land Reforms Act, 1960"), "Manipur Land Revenue and Land Reforms Act");
  assert.equal(shortActName("The Constitution of India"), "Constitution of India");
  assert.equal(shortActName(""), "");
  const n = gapNotice({ kind: "missing", number: "375", actTitle: IPC }, "https://indiacode.gov.in/x");
  assert.equal(n.text, "Section 375 of the Indian Penal Code isn't in our library yet.");
  assert.equal(n.label, "Read Section 375 of the Indian Penal Code on India Code (search for this Act)");
  assert.equal(n.actTitle, IPC);
});
test("one section is one gap, however many lookups reached it", () => {
  const a = { kind: "missing", number: "375", actTitle: IPC }, b = { kind: "missing", number: "375", actTitle: "The Indian Penal Code, 1860" }, c = { kind: "mentioned", number: "375", actTitle: "Indian Penal Code" }, d = { kind: "missing", number: "376", actTitle: IPC };
  assert.equal(uniqueGaps([a, b, c]).length, 1);
  assert.equal(uniqueGaps([a, d]).length, 2);
  assert.equal(gapLead([a, b]), "Section 375 of the Indian Penal Code isn't in our library yet.");
});
test("the model's words after the opening sentence do not repeat it or link India Code", () => {
  const gaps = [{ kind: "missing", number: "375", actTitle: IPC }];
  const text = "Section 375 of the Indian Penal Code isn't in our library yet.\n\nI couldn't find the section in the Acts I searched. You can read it on India Code. Rape is also dealt with in Section 63 of the BNS [1].";
  assert.equal(dropGapRepeats(text, gaps), "Section 375 of the Indian Penal Code isn't in our library yet.\n\nRape is also dealt with in Section 63 of the BNS [1].");
  assert.equal(dropGapRepeats("Section 375 of the Indian Penal Code isn't in our library yet.\n\nIt is not in the library, see https://indiacode.gov.in/x.", gaps), "Section 375 of the Indian Penal Code isn't in our library yet.");
  assert.equal(dropGapRepeats("An answer that mentions India Code.\n\nSecond paragraph about India Code.", []), "An answer that mentions India Code.\n\nSecond paragraph about India Code.");   // no gap: untouched
});
