import test from "node:test";
import assert from "node:assert/strict";
import { cleanHeading, stripTrailingHeadings, toDisplayBlocks, cleanParts, cleanPlain, previewText, stripJunk, tidySpacing, vocabOf } from "./clean.mjs";

// samples are real patterns found by scripts/audit/junk-scan-*.mjs (docs/audit-junk-*.json)
test("picture placeholders and stray halves of them never reach a reader", () => {
  assert.equal(cleanPlain("**==> picture [174 x 68] intentionally omitted <==** The rest"), "The rest");
  assert.equal(cleanPlain("Rangasayipuram **==> picture [187 x 12] intentionally omitted <==** 23. Next"), "Rangasayipuram 23. Next");
  assert.doesNotMatch(cleanPlain("text ==> more text <== end ==>"), /[=<>]{2}/);
});
test("HTML tags and entities, control characters and runs of lost characters are removed", () => {
  assert.equal(cleanPlain("writing &amp; printing paper&nbsp;and kraft<br/>paper"), "writing & printing paper and kraft\npaper");
  assert.equal(cleanPlain("21 \uFFFD \uFFFD \uFFFD and 22"), "21 and 22");
  assert.equal(stripJunk("a\u0000b\u000cc"), "abc");
  assert.equal(cleanPlain("line one \\n line two"), "line one line two");
});
test("markdown marks are removed", () => { assert.equal(cleanPlain("**13. Power to summon:-** (1) The `Director` _General_ may"), "13. Power to summon:- (1) The Director General may"); assert.equal(cleanPlain("> quoted\n## Heading text"), "quoted\nHeading text"); });
test("amendment numbers vanish from plain text and become footnote marks in reading views; ordinals survive", () => {
  assert.equal(cleanPlain("within 5[thirty days] of the receipt"), "within thirty days of the receipt");
  assert.deepEqual(cleanParts("to 4[two years], or"), [{ t: "text", v: "to two years" }, { t: "mark", n: 4 }, { t: "text", v: ", or" }]);
  assert.equal(cleanPlain("(As on 1[st] June, 2019)"), "(As on 1st June, 2019)");
  assert.equal(cleanPlain("[1] [( 1 )] Notwithstanding"), "(1) Notwithstanding");
});
test("spacing: ( a ), word ., runs of spaces", () => {
  assert.equal(tidySpacing("( a ) the payee , notice ."), "(a) the payee, notice.");
  assert.equal(tidySpacing("a  b\t\tc"), "a b c"); assert.equal(tidySpacing("Section 5 and 1 . 5 times"), "Section 5 and 1 . 5 times");   // a decimal point is left alone
  assert.equal(tidySpacing("S.O.(1)_30may2011 : note"), "S.O.(1)_30may2011: note");
});
test("joined words are split only with the section's own vocabulary", () => {
  const vocab = vocabOf(["the cheque is returned", "(a) thecheque has been presented"]);
  assert.equal(cleanPlain("(a) thecheque has been presented", vocab), "(a) the cheque has been presented");
  assert.equal(cleanPlain("thecheque", new Set()), "thecheque");
});
test("a preview skips headings and all-capital heading lines and is cut at a word", () => {
  assert.equal(previewText("## Heading\n\nTHE CHAPTER TITLE\n\n**==> picture omitted <==** The payee makes a demand within 4[thirty days] of receipt of the notice.", 60), "The payee makes a demand within thirty days of receipt of …");
  assert.equal(previewText("", 20), "");
});
test("clean text stays clean (idempotent)", () => { const once = cleanPlain("**(1)** Where any 3[ cheque ] is returned &amp; ( b ) notice ."); assert.equal(cleanPlain(once), once); });

import { RESIDUE, residue } from "./residue.mjs";
test("class check: no junk pattern survives cleaning, for samples of every pattern the audit found", () => {
  const samples = [
    "_GST - An Update_ _**(As on 1[st] June, 2019)**_ **==> picture [174 x 68] intentionally omitted <==** invoice",
    "FAUJDARI ADALAT 4[a term which may be extended to two years], or 5[with fine] and [1] [( 1 )] Notwithstanding",
    "> quoted\n## Heading text\n**bold** and `code` and ( a ) the payee , notice .",
    "conditions for writing &amp; printing paper&nbsp;and <b>kraft</b><br/>paper &lt;x&gt; &quot;q&quot;",
    "C S_ a?p **� � �** **21 �** .. line one \\n line two\\ttab",
    "text\u0000with\u000ccontrol   and\t\tspaces ==> stray <== halves",
    "Section 5 . Where  any cheque is  returned 3[ by the bank ] unpaid ; then , ( 1 ) the drawer",
  ];
  for (const raw of samples) { const left = residue(cleanPlain(raw)); assert.deepEqual(left, [], `${left.join(", ")} left in: ${cleanPlain(raw)}`); }
  for (const raw of samples) for (const [name, re] of Object.entries(RESIDUE)) { const parts = cleanParts(raw).filter((p) => p.t === "text").map((p) => p.v).join(""); assert.ok(!re.test(parts) || name === "runs of spaces or tabs" || name === "space before punctuation", `${name} left in the reading-view text of: ${raw}`); }
  assert.ok(Object.keys(RESIDUE).length >= 12);
});

test("half an emphasis pair and runs of dashes are not shown", () => {
  assert.equal(cleanPlain("holder ... ibid_ , (w.e.f. 6-2-2003). liable"), "holder ... ibid, (w.e.f. 6-2-2003). liable");
  assert.equal(cleanPlain("_ibid_, again and snake_case_name stay"), "ibid, again and snake_case_name stay");
  assert.equal(cleanPlain("New Delhi ------for\n-----\nINFORMATION"), "New Delhi — for\n\nINFORMATION");
});

test("cleanHeading: the title only, never the run-on text, footnote marks, footnotes or placeholders", () => {
  assert.equal(cleanHeading("Uttering words, etc., with deliberate intent to wound religious feelings. — Whoever, with the"), "Uttering words, etc., with deliberate intent to wound religious feelings");
  assert.equal(cleanHeading("Rioting . — Whenever force or violence is used"), "Rioting");
  assert.equal(cleanHeading("Admission defined. --An admission is a statement,[1] [oral or documentary"), "Admission defined");
  assert.equal(cleanHeading("Presumption as to electronic records and[6] [electronic signatures]. -- (1) In any"), "Presumption as to electronic records and electronic signatures");
  assert.equal(cleanHeading("Abetment of offence punishable with imprisonment—if offence be not committed"), "Abetment of offence punishable with imprisonment—if offence be not committed");
  for (const junk of ["(no heading in our data)", 'Subs. by Act 26 of 1955, s. 117 and the Sch., for "transportation for life"', 'The word "the" rep by Act 12 of 1891, s. 2', "Certain words omitted by s. 3 and the Sch., ibid", "The Original words have successively been amended by Act 12 of 1891"]) assert.equal(cleanHeading(junk), null, junk);
});

test("a section's text loses the next chapter's heading stuck to its end (IPC 420), and nothing else", () => {
  const body = "**420. Cheating and dishonestly inducing delivery of property** . **\u2014** Whoever cheats shall be punished with imprisonment of either description for a term which may extend to seven years, and shall also be liable to fine.\n\n## _Of fraudulent deeds and dispositions of property_\n";
  assert.ok(stripTrailingHeadings(body).endsWith("and shall also be liable to fine."));
  assert.deepEqual(toDisplayBlocks(body).map((b) => b.type), ["p"]);
  assert.ok(!toDisplayBlocks(body).some((b) => /fraudulent deeds/i.test(b.text)));
  for (const [raw, want] of [
    ["Text of the section.\n\nOF FRAUDULENT FEEDS AND DISPOSITIONS OF PROPERTY", "Text of the section."],
    ["Text.\n\n## **CHAPTER - IV**", "Text."],
    ["Text.\n\n## THE SCHEDULE\n\n## OFFENCES TRIABLE BY A VILLAGE COURT\n", "Text."],        // several heading lines in a row
    ["Text.\n\n## **Power to make rules**", "Text."],
    ["Text.\n\n2[PART IIA\n\nUNIVERSAL SERVICE OBLIGATION FUND", "Text."],
  ]) assert.equal(stripTrailingHeadings(raw), want, raw);
  // real text is never cut: a heading with text after it, sentences, numbered clauses, notes that introduce text, a section that is only a heading, bracketed references
  for (const keep of [
    "Text.\n\n## CHAPTER IV\n\nThe first section of the next chapter shall apply.",
    "Text.\n\nPUNISHMENT SHALL BE DEATH.",
    "Text.\n\nPROVIDED THAT THE COURT MAY, IF IT THINKS FIT:",
    "Text.\n\n## Illustrations",
    "Text.\n\n## Explanation",
    "Text.\n\n## [ _See_ section 20]",
    "Text.\n\n## VII. Nothing",
    "Text.\n\n1. THE FIRST SECTION OF THE ACT",
    "Text.\n\nONE",
    "## **CHAPTER - IV**",                       // nothing would be left: unchanged
    "Text with no heading at all.",
  ]) assert.equal(stripTrailingHeadings(keep), keep, keep);
  assert.equal(stripTrailingHeadings(null), "");
});
