import test from "node:test";
import assert from "node:assert/strict";
import { entryHash, parseSupplementFile, sectionKeyFor } from "./parse.mjs";

const HEAD = (o = {}) => `# comment line\nAct: The Indian Contract Act, 1872\nAct ID: ${o.actId ?? "IND_central_2187"}\nSection: ${o.section ?? "28"}\nHeading: ${o.heading ?? "Agreements in restraint of legal proceedings"}\nReplaces existing text: ${o.replaces ?? "no"}\nSource: India Code\nSource URL: ${o.url ?? "https://www.indiacode.nic.in/x"}\nDate copied: ${o.date ?? "2026-10-24"}\n=== SECTION TEXT (paste below this line) ===\n`;
const BODY = "A made-up sample text that is long enough to count as a section for the tests.";

test("an empty text area is pending, never an error", () => { assert.equal(parseSupplementFile(HEAD() + "\n  \n").status, "pending"); assert.equal(parseSupplementFile(HEAD({ url: "", date: "" })).status, "pending"); });
test("a filled file gives an entry with the dataset-style key", () => {
  const r = parseSupplementFile(HEAD() + BODY + "\n\n\n\nSecond paragraph.", "a.txt");
  assert.equal(r.status, "ok"); assert.equal(r.entry.sectionKey, "s028"); assert.equal(r.entry.replaces, false); assert.equal(r.entry.source, "India Code"); assert.match(r.entry.body, /\n\nSecond paragraph\.$/);
  assert.equal(parseSupplementFile(HEAD({ section: "11a", replaces: "Yes" }) + BODY).entry.sectionKey, "s11A"); assert.equal(parseSupplementFile(HEAD({ section: "11a", replaces: "Yes" }) + BODY).entry.replaces, true);
  assert.deepEqual(["16", "138", "19A"].map(sectionKeyFor), ["s016", "s138", "s19A"]);
});
test("each missing or wrong header field is named", () => {
  const e = (o) => parseSupplementFile(HEAD(o) + BODY).errors.join(" | ");
  assert.match(e({ url: "" }), /Source URL/); assert.match(e({ url: "not a url" }), /Source URL/); assert.match(e({ date: "24/10/2026" }), /Date copied/); assert.match(e({ date: "2026-02-31" }), /Date copied/);
  assert.match(e({ date: "2099-01-01" }), /future/); assert.match(e({ section: "twenty" }), /Section/); assert.match(e({ actId: "../x" }), /Act ID/); assert.match(e({ replaces: "maybe" }), /yes or no/);
  assert.match(parseSupplementFile(HEAD() + "tiny").errors.join(), /very short/);
  assert.match(parseSupplementFile(HEAD() + "<p>" + BODY + "</p>").errors.join(), /markup/);
  assert.match(parseSupplementFile("Act: x\nSection: 1\n").errors.join(), /SECTION TEXT/);
  assert.match(parseSupplementFile("Colour: red\n=== SECTION TEXT ===\n" + BODY).errors.join(), /Unknown header/);
});
test("the hash changes with the text or any header field, not with line endings", () => {
  const a = parseSupplementFile(HEAD() + BODY).entry, b = parseSupplementFile((HEAD() + BODY).replace(/\n/g, "\r\n")).entry, c = parseSupplementFile(HEAD() + BODY + " More.").entry, d = parseSupplementFile(HEAD({ date: "2026-10-25" }) + BODY).entry;
  assert.equal(entryHash(a), entryHash(b)); assert.notEqual(entryHash(a), entryHash(c)); assert.notEqual(entryHash(a), entryHash(d));
});

// ---- reading sections out of an Act PDF (scripts/supplement): synthetic lines, as pdf-text.mjs would deliver them
import { listSections } from "../../../scripts/supplement/list-sections.mjs";
import { cutSection } from "../../../scripts/supplement/extract-sections.mjs";
const L = (text, o = {}) => ({ page: 1, y: 500, size: 11, x: 72, xEnd: 500, centered: false, text, ...o });
const ACT = [
  L("1. Short title.—This Act may be called the Test Act, 1900."),
  L("2. Definitions.—In this Act,—"), L("(a) “thing” means a thing;"), L("(b) “other” means other things within clause"), L("(c) of section 5 applies."),
  L("Illustrations", { centered: true }), L("(a) A does a thing."),
  L("Sale", { centered: true, x: 200, xEnd: 300 }),
  L("3. Heading that wraps over two"), L("lines.—The text of three."),
  L("STATE AMENDMENTS", { centered: true }), L("Assam"), L("3A. Inserted by a state.—Not part of the Central Act."),
  L("4. [Repealed.] Rep. by Act 9 of 1950."),
  L("5. Presumption of something."), L("Presumption in case of advances.—The text of five, pre-"), L("emption and sub-"), L("ordinate things."),
  L("[6. Omitted heading.] Omitted by Act 3 of 1960."),
  L("CHAPTER II", { centered: true }), L("7. Seventh.—Text of seven subordinate."),
  L("THE SCHEDULE", { centered: true }),
];
test("sections are listed in order: wrapped headings, repealed notes, a heading alone on its line; state insertions and the schedule are not sections", () => {
  const s = listSections(ACT);
  assert.deepEqual(s.map((x) => x.number), ["1", "2", "3", "4", "5", "6", "7"]);
  assert.deepEqual(s.map((x) => x.kind), ["strict", "strict", "wrapped", "repealed", "headOnly", "repealed", "strict"]);
});
test("a section is cut at the next section, without cross-headings, state amendments or the schedule", () => {
  const at = (n) => listSections(ACT).find((x) => x.number === n).line;
  const two = cutSection(ACT, "2", at("2"));
  assert.equal(two.heading, "Definitions"); assert.match(two.text, /^In this Act,—\n\(a\) “thing” means a thing;\n\(b\) “other” means other things within clause \(c\) of section 5 applies\.\n\nIllustrations\n\(a\) A does a thing\.$/);   // "(c)" mid-sentence stays in the sentence
  assert.ok(!/Sale/.test(two.text));
  const three = cutSection(ACT, "3", at("3")); assert.equal(three.heading, "Heading that wraps over two lines"); assert.equal(three.text, "The text of three."); assert.ok(!/Assam|3A/.test(three.text));
  const four = cutSection(ACT, "4", at("4")); assert.equal(four.heading, "Repealed"); assert.equal(four.repealed, true); assert.equal(four.text, "Rep. by Act 9 of 1950.");
  const five = cutSection(ACT, "5", at("5")); assert.equal(five.heading, "Presumption of something"); assert.match(five.text, /^Presumption in case of advances\.—The text of five, pre-emption and subordinate things\.$/);
  const six = cutSection(ACT, "6", at("6")); assert.equal(six.heading, "Omitted heading"); assert.equal(six.text, "Omitted by Act 3 of 1960.");
  assert.equal(cutSection(ACT, "7", at("7")).text, "Text of seven subordinate.");
});
