import test from "node:test";
import assert from "node:assert/strict";
import list from "../../config/known-words.json" with { type: "json" };
import { scanJunkScore, looksLikeScanJunk, MIN_ODD, MIN_SHARE } from "./scanJunk.mjs";
import { effectiveStatus } from "./contentsList.mjs";

const JUNK = "18. (1) Wherc h c landlord obtains dclivery of possession of any premises from ~ h c tenant in pursuance of an ordcr of the court, such landlord shall within thrce months rcstore the tcnant to possession of thc prcmises, and if hc fails to do so the Controllcr shall dircct that thc tenant be rcinstated.";
const SCHEDULE_TECH = "11. Infection with ostreid herpes virus. 1. Taura syndrome. 2. White spot disease. 3. Yellowhead disease. 4. Infectious hypodermal and haematopoietic necrosis. 5. Infectious myonecrosis. Pepper, ginger, cashewnut, cardamom, chillies and turmeric. Polyvinyl chloride, calcium carbonate, chalk, whiting and calcite.";
const NAMES = "17. Godda.— Godda Police Station (excluding Burhikura, Dammajhilua, Sandmara, Nonbatta, Makhni, Pathra and Mahagama) Deoghar Jamtara Dumka Pakur Sahebganj Giridih Bokaro Hazaribagh Ramgarh Chatra Koderma Palamu Garhwa Latehar";
const NORMAL = "420. Cheating and dishonestly inducing delivery of property.—Whoever cheats and thereby dishonestly induces the person deceived to deliver any property to any person, shall be punished with imprisonment of either description for a term which may extend to seven years, and shall also be liable to fine.";

test("scan damage is flagged", () => {
  const s = scanJunkScore(JUNK);
  assert.ok(s.odd >= MIN_ODD && s.share >= MIN_SHARE, JSON.stringify(s));
  assert.ok(looksLikeScanJunk(JUNK));
});
test("real law text with technical words is not flagged (diseases, crops, chemicals)", () => { assert.ok(!looksLikeScanJunk(SCHEDULE_TECH), JSON.stringify(scanJunkScore(SCHEDULE_TECH))); assert.ok(!looksLikeScanJunk(NORMAL)); });
test("capitalised words (names, places, Acts) are not counted", () => { assert.ok(!looksLikeScanJunk(NAMES), JSON.stringify(scanJunkScore(NAMES))); });
test("short text is never judged; the thresholds are the agreed ones (at least 6 odd words and at least 20%)", () => {
  assert.equal(scanJunkScore("Wherc h c landlord obtains dclivery"), null);
  assert.equal(MIN_ODD, 6); assert.equal(MIN_SHARE, 0.2);
  assert.ok(!looksLikeScanJunk("The landlord obtains delivery of possession of the premises in pursuance of an ordcr of the court, and thc tenant shall give possession within thrce months of the date of the said order of the court."), "3 odd words are never enough");
});
test("the word list: a plain string of English and legal words, small enough to commit, with the known test words", () => {
  const words = String(list.words).split(" ");
  assert.ok(words.length > 15000 && words.length < 60000, String(words.length));
  assert.ok(String(list.words).length < 400 * 1024);
  const set = new Set(words);
  for (const w of ["ginger", "differential", "polyvinyl", "ordinance", "landlord", "panchayat"]) assert.ok(set.has(w), w);
  for (const w of ["wherc", "dclivery", "rcstore", "thrce"]) assert.ok(!set.has(w), w);
  assert.match(list.method, /Rebuild/);
});
test("the label only: scan junk turns 'complete' into 'possibly incomplete'; nothing else changes", () => {
  assert.equal(effectiveStatus("complete", { body: JUNK }), "possibly_incomplete");
  assert.equal(effectiveStatus("complete", { body: SCHEDULE_TECH }), "complete");
  assert.equal(effectiveStatus("complete", { body: NORMAL }), "complete");
  assert.equal(effectiveStatus("garbled", { body: JUNK }), "garbled");
  assert.equal(effectiveStatus("possibly_incomplete", { body: NORMAL }), "possibly_incomplete");
  assert.equal(effectiveStatus("complete", { body: null }), "complete");
});
