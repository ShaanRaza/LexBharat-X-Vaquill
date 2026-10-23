// node --test src/lib/acts/reassemble.test.mjs   (also part of `npm run test:extract`)
// Fixtures are trimmed copies of REAL chunks from open-india-law v2026.08 (CC BY 4.0), keeping their ids, headers and quirks.
import test from "node:test";
import assert from "node:assert/strict";
import { parseChunkId, compareChunks, splitHeader, reassembleAct, countFlags, isGarbled, headingNameReliable, mojibakeDevanagari } from "./reassemble.mjs";
import { collapseLetterSpacing, stripMarkdown, toDisplayBlocks, cleanHeading } from "./cleanText.mjs";

const hdr = (act, chapter, no, title) => `Act: ${act} | India | Central | In Force\n${chapter ? `Chapter ${chapter} | ` : ""}Section ${no}: ${title}\n\n`;
const NI = "The Negotiable Instruments Act, 1881 (Act 26 of 1881)";
const row = (actId, chunkId, sectionNumber, text) => ({ actId, chunkId, sectionNumber, text });

test("parseChunkId understands the id families", () => {
  assert.deepEqual(parseChunkId("IND_central_2189_s138_p1", "IND_central_2189"), { kind: "s", token: "138", key: "s138", subs: [], p: 1, d: null });
  const a = parseChunkId("IND_state_12031_s045_7_d4", "IND_state_12031");
  assert.equal(a.key, "s045"); assert.deepEqual(a.subs, [{ n: 7 }]); assert.equal(a.d, 4);
  assert.equal(parseChunkId("IND_central_1_s012A", "IND_central_1").token, "012A");
  assert.equal(parseChunkId("IND_central_1_b022", "IND_central_1").kind, "b");
  assert.equal(parseChunkId("OTHER_s1", "IND_central_1"), null);
  assert.equal(parseChunkId("IND_central_1534_s28-I_1", "IND_central_1534").token, "28-I");
  assert.equal(parseChunkId("IND_state_15805_s3Z-1_2", "IND_state_15805").key, "s3Z-1");
  assert.equal(parseChunkId("IND_state_15965_s3(A)", "IND_state_15965").key, "s3(A)");
  assert.equal(parseChunkId("IND_state_20149_s0१०", "IND_state_20149").key, "s0१०");
});

test("chunks inside a section are ordered bare, parts, then sub-sections with their continuations", () => {
  const ids = ["s045_7_d1", "s045_p0", "s045_2", "s045", "s045_1_d1", "s045_10", "s045_1", "s045_7"].map((s) => ({ id: parseChunkId(`A_${s}`, "A") }));
  assert.deepEqual(ids.sort(compareChunks).map((c) => c.id.subs.map((x) => x.n).join(".") + `|p${c.id.p}|d${c.id.d}`), ["|pnull|dnull", "|p0|dnull", "1|pnull|dnull", "1|pnull|d1", "2|pnull|dnull", "7|pnull|dnull", "7|pnull|d1", "10|pnull|dnull"]);
});

test("NI Act s.138: parts are put in order, text is complete, the letter-spaced chapter label is not shown", () => {
  const A = "IND_central_2189", h = hdr(NI, "XVI: O F I N T E R N A T I O N A L LA W", "138", "Dishonour of cheque for insufficiency, etc., of funds in the account");
  const rows = [
    row(A, `${A}_s138_p1`, "138", h + "( _c_ ) the drawer of such cheque fails to make the payment within fifteen days of the receipt of the said notice.\n\n_Explanation_ .—For the purposes of this section, debt means a legally enforceable debt."),
    row(A, `${A}_s138_p0`, "138", h + "**138. Dishonour of cheque for insufficiency, etc., of funds in the account.—** Where any cheque drawn by a person on an account is returned by the bank unpaid ...\n\nProvided that nothing contained in this section shall apply unless—"),
    row(A, `${A}_s139`, "139", hdr(NI, "XVI: O F I N T E R N A T I O N A L LA W", "139", "Presumption in favour of holder") + "**139. Presumption in favour of holder.—** It shall be presumed..."),
  ];
  const { sections } = reassembleAct(rows);
  const s = sections.find((x) => x.number === "138");
  assert.equal(s.heading, "Dishonour of cheque for insufficiency, etc., of funds in the account");
  assert.deepEqual(s.chunkIds, [`${A}_s138_p0`, `${A}_s138_p1`]);
  assert.ok(s.text.indexOf("Provided that") < s.text.indexOf("fails to make the payment"));
  assert.ok(!s.text.includes("Act: "), "dataset header lines are not part of the text");
  assert.equal(s.status, "complete");
  assert.equal(s.chapter, null);
  assert.ok(s.chapterCheck.includes("name_unreliable"));
  assert.equal(s.chapterRaw.name, "O F I N T E R N A T I O N A L LA W", "the raw label is kept unchanged in the data");
});

test("Indian Contract Act s.10: a clean single chunk; the chapter label passes when it agrees with the CHAPTER heading in the text", () => {
  const A = "IND_central_2187", T = "The Indian Contract Act, 1872 (Act 9 of 1872)", ch2 = "II: OF CONTRACTS, VOIDABLE CONTRACTS AND VOID AGREEMENTS", ch1 = "I: OF THE COMMUNICATION, ACCEPTANCE AND REVOCATION OF PROPOSALS";
  const rows = [
    row(A, `${A}_s009`, "9", hdr(T, ch1, "9", "Promises, express and implied**") + "**9. Promises, express and implied** .—In so far as the proposal ..."),
    row(A, `${A}_s010`, "10", hdr(T, ch2, "10", "What agreements are contracts**") + "## CHAPTER II\n\nOF CONTRACTS, VOIDABLE CONTRACTS AND VOID AGREEMENTS\n\n**10. What agreements are contracts** .—All agreements are contracts if they are made by the free consent ..."),
    row(A, `${A}_s011`, "11", hdr(T, ch2, "11", "Who are competent to contract**") + "**11. Who are competent to contract** .—Every person is competent ..."),
  ];
  const s = reassembleAct(rows).sections.find((x) => x.number === "10");
  assert.equal(s.heading, "What agreements are contracts");
  assert.equal(s.status, "complete");
  assert.deepEqual(s.chapter, { roman: "II", name: "OF CONTRACTS, VOIDABLE CONTRACTS AND VOID AGREEMENTS" });
  assert.equal(s.chapterCheck, "pass");
});

test("a chapter label that contradicts the CHAPTER heading inside the text is hidden", () => {
  const A = "IND_central_9", T = "Some Act, 1900";
  const rows = [row(A, `${A}_s001`, "1", hdr(T, "I: PRELIMINARY", "1", "Title") + "## CHAPTER II\n\nBODY\n\n1. text")];
  assert.ok(reassembleAct(rows).sections[0].chapterCheck.includes("contradicts_embedded_heading"));
});

test("a section whose chunks mix families, skip a sub-section or name another section is possibly incomplete (real Act 12031 s.45 shape)", () => {
  const A = "IND_state_12031", T = "A State Act, 1990 (Act 1 of 1990)", H = (no) => hdr(T, "VII: RECOVERY", no, "Recovery of tax");
  const ids = ["s045", "s045_p0", "s045_1", "s045_1_d1", "s045_2", "s045_3", "s045_4", "s045_6", "s045_7"];
  const rows = ids.map((i) => row(A, `${A}_${i}`, "45", (i === "s045" ? hdr(T, null, "46", "Other") : H("45")) + `text of ${i}`));
  const s = reassembleAct(rows).sections[0];
  assert.equal(s.status, "possibly_incomplete");
  for (const f of ["mixed_structure", "sub_gap", "header_mismatch"]) assert.ok(s.flags.includes(f), f);
});

test("a header that names a sub-section of the same section is not a mismatch", () => {
  const A = "IND_central_1822", T = "Y Act, 1960", rows = [row(A, `${A}_s009_1`, "9", hdr(T, null, "9(1)", "Payment") + "(1) text"), row(A, `${A}_s009_p0`, "9", hdr(T, null, "9", "Payment") + "heading")];
  assert.ok(!reassembleAct(rows).sections[0].flags.includes("header_mismatch"));
});

test("a gap in the _p parts is flagged; exact duplicate chunks are collapsed", () => {
  const A = "IND_central_5", T = "X Act, 1950";
  const rows = [row(A, `${A}_s003_p0`, "3", hdr(T, null, "3", "T") + "part zero"), row(A, `${A}_s003_p2`, "3", hdr(T, null, "3", "T") + "part two"), row(A, `${A}_s003_d1`, "3", hdr(T, null, "3", "T") + "part zero")];
  const s = reassembleAct(rows).sections[0];
  assert.ok(s.flags.includes("part_gap")); assert.ok(s.flags.includes("duplicates_collapsed"));
  assert.equal(s.text, "part zero\n\npart two");
});

test("U+FFFD marks lost characters; mojibake Hindi is garbled; clean Hindi is only flagged devanagari; an Act with no section numbers is flagged", () => {
  const A = "IND_central_7", T = "Y Act, 1960", ok = "see rule 5 (नियम)"; // a short Devanagari fragment
  const bad = "िानकारी के प्रसार और अप्रकालशत कीमत संिेदिशीि जािकारी ककसी ज्येष्ठ अधधकारी को ो ्य";
  assert.ok(mojibakeDevanagari(bad) >= 3 && isGarbled(bad)); assert.ok(!isGarbled(ok));
  const rows = [
    row(A, `${A}_s001`, "1", hdr(T, null, "1", "A") + "The fee is � 500."),
    row(A, `${A}_s002`, "2", hdr(T, null, "2", "B") + bad),
    row(A, `${A}_s003`, "3", hdr(T, null, "3", "C") + ok),
    row(A, `${A}_b001`, "", "preamble text with no section number"),
  ];
  const { sections } = reassembleAct(rows);
  const by = (k) => sections.find((s) => s.key === k);
  assert.equal(by("s001").status, "possibly_incomplete"); assert.ok(by("s001").flags.includes("lost_characters"));
  assert.equal(by("s002").status, "garbled");
  assert.equal(by("s003").status, "complete"); assert.ok(by("s003").flags.includes("devanagari"));
  assert.ok(by("b001").flags.includes("no_section_number"));
  assert.equal(sections.at(-1).key, "b001", "unnumbered blocks come after the numbered sections");
  const c = countFlags(sections);
  assert.equal(c.sections, 4); assert.equal(c.garbled, 1); assert.equal(c.devanagari, 2); assert.equal(c.no_section_number, 1); assert.equal(c.possibly_incomplete, 1);
});

test("Hindi pieces (20+ Devanagari characters) are not shown; a section that is only Hindi is not shown at all; the raw text keeps everything", () => {
  const A = "IND_central_1593", T = "MTP Act, 1971", hi = "गभ का जचदकत्सीय समापन जनयम, 2003 जिन्द्हें इसमें इसके जनयम";
  const rows = [row(A, `${A}_s002`, "2", hdr(T, null, "2", "Definitions") + "In this Act, the Proclamation means the Proclamation issued in 1971."), row(A, `${A}_s002_d2`, "2", hdr(T, null, "2", "Definitions") + hi),
    row(A, `${A}_s004`, "4", hdr(T, null, "4", "Hindi only") + hi)];
  const { sections } = reassembleAct(rows), by = (k) => sections.find((x) => x.key === k);
  assert.equal(by("s002").displayText, "In this Act, the Proclamation means the Proclamation issued in 1971.");
  assert.ok(by("s002").text.includes(hi), "raw text is untouched");
  assert.equal(by("s002").status, "possibly_incomplete"); assert.ok(by("s002").flags.includes("hindi_pieces_hidden") && by("s002").flags.includes("devanagari"));
  assert.equal(by("s004").status, "garbled"); assert.ok(by("s004").flags.includes("hindi_unverifiable"));
  assert.equal(reassembleAct([row(A, `${A}_s009`, "9", hdr(T, null, "9", "Short") + "Rule 5 (नियम)")]).sections[0].displayText, null, "short Devanagari fragments stay");
});

test("headingNameReliable rejects letter-spaced, empty and lost-character names", () => {
  assert.equal(headingNameReliable("O F I N T E R N A T I O N A L LA W"), false);
  assert.equal(headingNameReliable(""), false);
  assert.equal(headingNameReliable("OF PENALTIES IN CASE OF DISHONOUR OF CERTAIN CHEQUES"), true);
  assert.equal(headingNameReliable("OF � CHEQUES"), false);
});

test("splitHeader strips only the two dataset header lines", () => {
  const h = splitHeader(hdr(NI, "XVII: OF PENALTIES", "138", "Dishonour") + "body line 1\n\nbody line 2");
  assert.deepEqual(h.chapter, { roman: "XVII", name: "OF PENALTIES" }); assert.equal(h.sectionNo, "138"); assert.equal(h.body, "body line 1\n\nbody line 2");
  assert.equal(splitHeader("no header at all").body, "no header at all");
});

test("display cleanup: letter spacing, markdown and headings (display only)", () => {
  assert.deepEqual(collapseLetterSpacing("C H A P T E R"), { text: "CHAPTER", ambiguous: false });
  assert.equal(collapseLetterSpacing("O F I N T E R N A T I O N A L").ambiguous, true);
  assert.equal(collapseLetterSpacing("section A B and plain words").text, "section A B and plain words");
  assert.equal(stripMarkdown("( _a_ ) the **drawer** fails"), "(a) the drawer fails");
  assert.equal(cleanHeading("## **CHAPTER VII. RECOVERY**"), "CHAPTER VII. RECOVERY");
  assert.equal(cleanHeading("O F I N T E R N A T I O N A L"), null);
  assert.equal(cleanHeading("िानकारी के प्रसार"), null, "Hindi headings are not shown");
  assert.equal(cleanHeading("Short title \uFFFD"), null);
  const b = toDisplayBlocks("## C H A P T E R  I\n\nPRELIMINARY\n\n**1. Short title.—** This Act ( _a_ ) applies.");
  assert.deepEqual(b.map((x) => x.type), ["heading", "p", "p"]);
  assert.equal(b[2].text, "1. Short title.— This Act (a) applies.");
});
