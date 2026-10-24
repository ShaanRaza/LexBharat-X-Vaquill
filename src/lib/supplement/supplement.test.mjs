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
