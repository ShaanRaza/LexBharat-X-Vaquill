// Unit tests for the Supreme Court heading extraction. Run: npm run test:extract   (node --test, no dependencies)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildVocabulary, cleanName, looksLikeName, nameKey, parseCaseNumber, printedBench, verifyBench, withinGuard } from "./extract.mjs";

const fx = JSON.parse(readFileSync(new URL("./extract.fixtures.json", import.meta.url), "utf8"));
const vocab = new Map(Object.entries(fx.vocabulary));
const pad = (s, n = 3000) => s.padEnd(n, " x");                       // opening chunks are about 3-4 thousand characters long
const bench = (text, authoring = []) => { const p = printedBench(pad(text)); return p ? verifyBench(p.names, vocab, authoring) : null; };

test("14 real cases: 4 named + 10 drawn at random (fixed seed), output checked by eye against the heading", () => {
  assert.equal(fx.cases.length, 14);
  for (const c of fx.cases) {
    const p = printedBench(c.text, c.caseId), got = p ? verifyBench(p.names, vocab, c.authoring) : null;
    assert.deepEqual(got, c.bench, `bench of ${c.caseId}`);
    assert.equal(parseCaseNumber(c.text, Number(c.caseId.slice(0, 4)) + 1, c.caseId), c.caseNumber, `case number of ${c.caseId}`);
  }
});

test("the four named cases", () => {
  const by = Object.fromEntries(fx.cases.map((c) => [c.caseId, c]));
  const kes = printedBench(by["1973_INSC_91"].text);
  assert.equal(kes.names.length, 13);                                      // the 13-judge Kesavananda Bharati bench, OCR repairs included
  assert.deepEqual(verifyBench(kes.names, vocab, ["S.M. SIKRI"]).slice(0, 3), ["S.M. SIKRI", "J.M. SHELAT", "K.S. HEGDE"]);
  assert.equal(parseCaseNumber(by["1973_INSC_91"].text, 1974), null);      // that heading prints no case number: absent, not guessed
  assert.equal(parseCaseNumber(by["2024_INSC_1046"].text, 2025), "Criminal Appeal No. 5491 of 2024");   // Muskan Enterprises
  assert.equal(parseCaseNumber(by["2025_INSC_1184"].text, 2026), "Criminal Appeal No. 715 of 2018");    // Nazim
  assert.equal(parseCaseNumber(by["2022_INSC_326"].text, 2023), "Criminal Appeal No. 463 of 2022");     // Vijay Kumar Ghai
});

test("bench shapes: [A and B, JJ.], [A, B and C, JJ.], [A, CJI and B, JJ.], parentheses, title case with asterisk", () => {
  assert.deepEqual(printedBench(pad("X v. Y [S.B. SINHA AND LOKESHWAR SINGH PANTA, JJ.] Held")).names, ["S.B. SINHA", "LOKESHWAR SINGH PANTA"]);
  assert.deepEqual(printedBench(pad("X v. Y [A. M. KHANWILKAR, R. F. NARIMAN AND INDU MALHOTRA, JJ.] Held")).names, ["A. M. KHANWILKAR", "R. F. NARIMAN", "INDU MALHOTRA"]);
  assert.deepEqual(printedBench(pad("X v. Y [DIPAK MISRA, CJI, A. M. KHANWILKAR AND DR. D. Y. CHANDRACHUD, JJ.] Held")).names, ["DIPAK MISRA", "A. M. KHANWILKAR", "DR. D. Y. CHANDRACHUD"]);
  assert.deepEqual(printedBench(pad("X v. Y (B.N. KIRPAL AND S. RAJENDRA BABU, JJ.) Held")).names, ["B.N. KIRPAL", "S. RAJENDRA BABU"]);
  assert.deepEqual(printedBench(pad("X v. Y [Surya Kant* and K.V. Viswanathan, JJ.] Held")).names, ["Surya Kant", "K.V. Viswanathan"]);
  assert.deepEqual(printedBench(pad("X v. Y [V.N. KHARE, CJ. AND S.B. SINHA, J.] Held")).names, ["V.N. KHARE", "S.B. SINHA"]);
});

test("OCR repairs: stray dot, IC for K, an initial J whose full stop became a comma, a stray quote, AND glued to an initial", () => {
  assert.equal(cleanName("D. G. PALEK.AR"), "D. G. PALEKAR");
  assert.equal(cleanName("IC K. MATHEW"), "K. K. MATHEW");
  assert.deepEqual(printedBench(pad("[M. HIDAYATULLAH, C.J., J, C. SHAH, K. S. HEGDE AND I. D. DUA, JJ.) x")).names, ["M. HIDAYATULLAH", "J. C. SHAH", "K. S. HEGDE", "I. D. DUA"]);
  assert.deepEqual(printedBench(pad('(A.M. AHMADI AND"M.M. PUNCHHI, JJ.] x')).names, ["A.M. AHMADI", "M.M. PUNCHHI"]);
  assert.deepEqual(printedBench(pad("[R. F. NARIMAN, ANIRUDDHA BOSE ANDV. RAMASUBRAMANIAN, JJ.] x")).names, ["R. F. NARIMAN", "ANIRUDDHA BOSE", "V. RAMASUBRAMANIAN"]);
  assert.deepEqual(printedBench(pad("[K. SUBBA RAO, C.J., J. C. SHAH AND S. M. SIKRI, JJ.j x")).names, ["K. SUBBA RAO", "J. C. SHAH", "S. M. SIKRI"]);   // closing bracket read as j
});

test("never a wrong bench: glued names, OCR-damaged letters, non-names and unknown judges give null", () => {
  assert.equal(printedBench(pad("[A.S. BOPANNA ANDHRISHIKESH ROY, JJ.] x")), null);            // glued AND
  assert.equal(printedBench(pad("[B.N. KIRPAL AND S. RAJENDRA BABU, JJ.] and [KURIAN JOSEPH ANDMOHAN M. SHANTANAGOUDAR, JJ.]")).names.length, 2);   // only the first block counts
  assert.equal(printedBench(pad("[P. N. BHAGWATI, V. R. KRISHNA IYER AND S. M. FAZAL Au, JJ.] x")), null);   // "Au": mixed case inside one name
  assert.equal(printedBench(pad("[ACTING C.J., JJ.] x")), null);
  assert.equal(printedBench(pad("Judgment of the Court was delivered by SHAH, J. x")), null);   // no bracketed block
  assert.equal(bench("[SOMEBODY UNKNOWN AND S.M. SIKRI, JJ.] x"), null);                       // not in the vocabulary
  assert.equal(bench("[S.M. SIKRI AND J.M. SHELAT, JJ.] x", ["K.S. HEGDE"]), null);            // the dataset's own judge must be on the bench
  assert.deepEqual(bench("[S.M. SIKRI AND J.M. SHELAT, JJ.] x", ["J.M. SHELAT"]), ["S.M. SIKRI", "J.M. SHELAT"]);
  assert.equal(looksLikeName("G.B. PATTANAIK"), true);
  assert.equal(looksLikeName("FAZAL Au"), false);
  assert.equal(looksLikeName("PRABHUDESSAI AND JUSTICE"), false);
});

test("vocabulary: dominant spellings only, OCR variants and rare spellings are left out, dataset names always kept", () => {
  const list = [...Array(20)].map(() => ["G.B. PATTANAIK", "S.B. SINHA"]).concat([...Array(3)].map(() => ["G.B. PATTANAJK", "S.B. SINHA"]), [["R. RARE JUDGE"]]);
  const v = buildVocabulary(list, new Map([[nameKey("A.K. KNOWN"), "A.K. KNOWN"]]));
  assert.ok(v.has(nameKey("G.B. PATTANAIK")) && v.has(nameKey("S.B. SINHA")) && v.has(nameKey("A.K. KNOWN")));
  assert.ok(!v.has(nameKey("G.B. PATTANAJK")) && !v.has(nameKey("R. RARE JUDGE")));
  const near = buildVocabulary([...Array(60)].map(() => ["UDAY UMESH LALIT"]).concat([...Array(11)].map(() => ["UDAY UMESH LAUT"])));
  assert.ok(near.has(nameKey("UDAY UMESH LALIT")) && !near.has(nameKey("UDAY UMESH LAUT")));   // a two-letter variant of a long name, even if printed 11 times, loses to a spelling 5x as common
  const tie = buildVocabulary([...Array(30)].map(() => ["UDAY UMESH LALIT"]).concat([...Array(11)].map(() => ["UDAY UMESH LAUT"])));
  assert.ok(!tie.has(nameKey("UDAY UMESH LALIT")) && !tie.has(nameKey("UDAY UMESH LAUT")));      // neither is clearly dominant: neither is trusted
});

test("a one-edit OCR variant of exactly one known name is read as that name; short keys are never repaired", () => {
  const v = new Map([[nameKey("UDAY UMESH LALIT"), "UDAY UMESH LALIT"], [nameKey("H.L. DATTU"), "H.L. DATTU"], [nameKey("M.R. SHAH"), "M.R. SHAH"], [nameKey("M.B. SHAH"), "M.B. SHAH"]]);
  assert.deepEqual(verifyBench(["UDAY UMESH LAUT", "M.R. SHAH"], v), ["UDAY UMESH LALIT", "M.R. SHAH"]);
  assert.equal(verifyBench(["H.L. DATIU"], v), null);                                        // 7 letters: too short to repair, so a damaged short name is left out
  assert.equal(verifyBench(["M.X. SHAH"], v), null);                                          // and M.R. SHAH / M.B. SHAH can never be confused
});

test("case numbers", () => {
  const n = (s, y = 2030) => parseCaseNumber(pad(s), y);
  assert.equal(n("U v. V (Criminal Appeal No. 5491 of 2024) B"), "Criminal Appeal No. 5491 of 2024");
  assert.equal(n("U v. V (Crl. Appeal Nos. 1234-1235 of 2016) B"), "Crl. Appeal Nos. 1234-1235 of 2016");
  assert.equal(n("U v. V (Civil Appeal Nos. 2950-2951 of 2014) B"), "Civil Appeal Nos. 2950-2951 of 2014");
  assert.equal(n("U v. V (Civil Appeal No(s). 4281 of 2006) B"), "Civil Appeal No. 4281 of 2006");
  assert.equal(n("U v. V (Civil Appeal No. 1585 of2017 and Criminal Appeal No. 77 of 2016) B"), "Civil Appeal No. 1585 of 2017 and Criminal Appeal No. 77 of 2016");
  assert.equal(n("U v. V (Writ Petition (c) No. 317 of 2010) B"), "Writ Petition (C) No. 317 of 2010");
  assert.equal(n("U v. V (Special Leave Petition (Crl.) No. 55 of 2019) B"), "Special Leave Petition (Crl.) No. 55 of 2019");
  assert.equal(n("U v. V (SLP (C) No. 9 of 2018) B"), "SLP (C) No. 9 of 2018");
  assert.equal(n("U v. V (Curative Petition (C) No. 44 of 2013) B"), "Curative Petition (C) No. 44 of 2013");
  assert.equal(n("U v. V (Transfer Petition (Civil) Nos. 1-3 of 2020) B"), "Transfer Petition (Civil) Nos. 1-3 of 2020");
  assert.equal(n("U v. V [Review Petition (Civil) No. 7 of 2019] B"), "Review Petition (Civil) No. 7 of 2019");
  assert.equal(n("U v. V (Contempt Petition (Crl.) No. 12 of 2018) B"), "Contempt Petition (Crl.) No. 12 of 2018");
});

test("case numbers: only the clean bracketed form, never a guess", () => {
  assert.equal(parseCaseNumber(pad("U v. V Civil Appeal No. 99 of 1975 was filed"), 2000), null);                         // not bracketed
  assert.equal(parseCaseNumber(pad("U v. V (Civil Appeal No. 99 of 1975 of this Court was heard) B"), 2000), null);       // not purely a case number
  assert.equal(parseCaseNumber(pad("U v. V (Civil Appeal No. 1585 of 2017) B"), 2016), null);                            // filed after it was decided
  assert.equal(parseCaseNumber(pad("U v. V (CrimlnalAppealNo. 5 of 2014) B"), 2015), null);                              // OCR-damaged type
  assert.equal(parseCaseNumber(pad("U v. V (Criminal Appeal No. of 2014) B"), 2015), null);
});

test("bad-match guard: warns and gives up when a match swallows too much of the text", () => {
  const seen = []; const orig = console.warn; console.warn = (m) => seen.push(m);
  try {
    assert.equal(withinGuard(300, 1000, 1, "bench", "X"), false);
    assert.equal(withinGuard(207, 4049, 13, "bench", "1973_INSC_91"), true);      // the 13-judge Kesavananda block is 5.1% of its chunk: allowed because it has 13 names
    assert.equal(withinGuard(40, 3000, 1, "case number"), true);
  } finally { console.warn = orig; }
  assert.equal(seen.length, 1);
  assert.match(seen[0], /exceeds the guard/);
});
