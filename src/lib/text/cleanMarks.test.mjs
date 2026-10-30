import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanMarks, findMarks, otherBrackets } from "./cleanMarks.mjs";

const c = (s) => cleanMarks(s).text;

test("a footnote-style amendment line is removed, the section text and paragraph breaks stay", () => {
  const raw = "138. Dishonour of cheque.\n\n(1) Where any cheque is returned unpaid, such person shall be deemed to have committed an offence.\n\n1. Subs. by Act 12 of 2013, s. 4, for \"two years\" (w.e.f. 1-2-2013).\n";
  assert.equal(c(raw), "138. Dishonour of cheque.\n\n(1) Where any cheque is returned unpaid, such person shall be deemed to have committed an offence.\n\n");
});
test("a bracketed amendment note inside a sentence is removed with one space", () => {
  assert.equal(c("the Court may [Subs. by Act 5 of 2008, s. 2, for \"Magistrate\"] order payment."), "the Court may order payment.");
  assert.equal(c("order payment [Ins. by Act 5 of 2008, s. 2]."), "order payment.");
});
test("picture placeholders go: comment, markdown image, img tag, [image]", () => {
  assert.equal(c("Form A <!-- image --> follows."), "Form A follows.");
  assert.equal(c("Seal ![seal](page1_img2.png) here"), "Seal here");
  assert.equal(c('Map <img src="m.png" alt="x"> end'), "Map end");
  assert.equal(c("Signed [image] by the Clerk"), "Signed by the Clerk");
});
test("HTML tags go, block tags become line breaks, entities become the real character", () => {
  assert.equal(c("<p>Rights &amp; duties</p><p>of the &quot;State&quot;</p>"), "Rights & duties\n\nof the \"State\"\n\n");
  assert.equal(c("line one<br/>line two"), "line one\nline two");
  assert.equal(c("<div>A</div><div>B</div>"), "A\n\nB\n\n");
  assert.equal(c("<ul><li>one</li><li>two</li></ul>"), "one\ntwo\n\n");
  assert.equal(c("it&#8217;s &lt; 5 years&nbsp;old"), "it’s < 5 years old");
  assert.equal(c("<b>Note</b>: x"), "Note: x");
});
test("status text and real brackets are kept", () => {
  for (const s of ["12. [Repealed.]", "13. [Omitted by Act 7 of 2017]", "[omitted]", "14. [Repealed by the Repealing Act, 2016.]", "* * * * *",
    "[Provided that nothing in this section shall apply to a minor.]", "1[(2) The Court may, for reasons recorded, extend the time.]", "Explanation.—For this section, [the Commissioner] means the officer."]) {
    assert.equal(c(s), s, s);
  }
});
test("ambiguous kinds are only reported, never cleaned", () => {
  const kinds = (s) => findMarks(s).filter((f) => f.group === "ambiguous").map((f) => f.kind);
  assert.ok(kinds("1[Provided that the fee is paid.]").includes("numbered_bracket"));
  assert.ok(kinds("It applies (w.e.f. 1-4-2020) to all.").includes("wef_note"));
  assert.ok(kinds("3. Omitted by Act 9 of 2012, s. 3.").includes("omitted_or_repealed_by_line"));
  assert.ok(kinds("text. Subs. by Act 3 of 2010 for the word x.").includes("inline_amendment_unbracketed"));
  assert.ok(kinds("[Repealed]").includes("status_bracket"));
  assert.ok(kinds("<Name of the person>").includes("unknown_html_tag"));
});
test("angle-bracket form placeholders and area units are not touched", () => {
  assert.equal(c("Dear <Name of the person>, plot of 20 m² and 5 cm³"), "Dear <Name of the person>, plot of 20 m² and 5 cm³");
});
test("superscript footnote digits after a word are removed", () => {
  assert.equal(c("the Registrar¹ shall² act"), "the Registrar shall act");
});
test("markdown footnote refs and definitions are removed", () => {
  assert.equal(c("Held so.[^3] Next.\n[^3]: Subs. by Act 1.\nEnd"), "Held so. Next.\nEnd");
});
test("Devanagari, numbering and blank lines are unchanged", () => {
  const s = "धारा 138. चेक का अनादरण।\n\n(1) जहाँ कोई चेक\n(a) पहला\n(i) दूसरा\n\n\nसमाप्त";
  assert.equal(cleanMarks(s).changed, false);
  assert.equal(c(s), s);
  assert.equal(c("धारा &amp; उपधारा <b>१</b>"), "धारा & उपधारा १");
});
test("running twice gives the same result (idempotent), including hidden tags in entities", () => {
  for (const s of ["a &amp;lt;b&amp;gt;x&amp;lt;/b&amp;gt; b", "&lt;p&gt;hi&lt;/p&gt;", "x [Subs. by Act 1 of 2000, s. 2] y <!-- image --> z &amp;amp; w", "1. Subs. by Act 2.\n2. Ins. by Act 3.\n"]) {
    const once = c(s);
    assert.equal(c(once), once, s);
    assert.equal(cleanMarks(once).changed, false);
  }
});
test("kinds are counted and empty or non-string input is safe", () => {
  const r = cleanMarks("a <b>x</b> &amp; [image] b");
  assert.deepEqual(r.kinds, { picture_placeholder: 1, html_tag: 2, html_entity: 1 });
  assert.equal(cleanMarks("").changed, false);
  assert.equal(cleanMarks(null).text, "");
});
test("otherBrackets lists only brackets no rule explains, digits normalised", () => {
  const o = otherBrackets("[the Commissioner] and [Repealed] and [Subs. by Act 1 of 2000, s. 2] and [Section 12]");
  assert.deepEqual(o.map((x) => x.key), ["[the commissioner]", "[section #]"]);
});
