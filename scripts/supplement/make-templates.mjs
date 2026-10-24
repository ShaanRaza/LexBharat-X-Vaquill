// Writes the empty fill-in files of content/supplement/ (never overwrites a file that already exists, so it cannot erase text you pasted). usage: node scripts/supplement/make-templates.mjs
// The topic lines are short hints in our own words, written from memory and NOT checked: they only tell you which section to look for. The number is what counts; confirm it on India Code.
import fs from "node:fs";
const DIR = "content/supplement";
const ACTS = {
  contract: ["The Indian Contract Act, 1872", "IND_central_2187"], cpc: ["The Code of Civil Procedure, 1908", "IND_central_2191"], limitation: ["The Limitation Act, 1963", "IND_central_1565"],
  ni: ["The Negotiable Instruments Act, 1881", "IND_central_2189"], sra: ["The Specific Relief Act, 1963", "IND_central_1583"], pca: ["The Prevention of Corruption Act, 1988", "IND_central_1558"],
  hma: ["The Hindu Marriage Act, 1955", "IND_central_1560"], stamp: ["The Indian Stamp Act, 1899", "IND_central_15510"],
};
// [act, section, topic hint, replaces-wrong-text?]
const LIST = [
  ["contract", "16", "undue influence: when a contract is induced by it"], ["contract", "28", "agreements that restrict going to court (or fix a time limit to sue)"], ["contract", "73", "compensation for loss caused by breach of contract"],
  ["contract", "124", "what a contract of indemnity is"], ["contract", "20", "agreement void when both sides are mistaken about a fact that matters"], ["contract", "24", "when part of the consideration or object is unlawful"],
  ["cpc", "11", "res judicata: a matter already decided cannot be tried again", true], ["cpc", "20", "where to sue: place of suing (defendant's residence, cause of arising)", true],
  ["cpc", "60", "what property can be attached in execution of a decree"], ["cpc", "92", "suits about public charities and trusts"], ["cpc", "109", "appeals to the Supreme Court"], ["cpc", "152", "correcting clerical or arithmetical mistakes in judgments and decrees"],
  ...["4", "5", "7", "8", "9", "10", "19", "22", "24", "27", "28"].map((n) => ["limitation", n, { 4: "period ending on a day the court is closed", 5: "extension of the period for an appeal or application (sufficient cause)", 7: "when one of several plaintiffs or applicants is under a disability", 8: "special exemptions not extended by the general rules", 9: "once time has started running, it does not stop", 10: "suits against trustees and their representatives", 19: "effect of a part-payment of a debt on the period", 22: "continuing breaches and wrongs", 24: "computing time for compensation for acts that are not actionable without special loss", 27: "when the right to property is extinguished", 28: "unsure what this number covers: check India Code" }[n]]),
  ["ni", "13", "what a negotiable instrument is"], ["ni", "56", "endorsement of part of the amount"], ["ni", "145", "evidence on affidavit in cheque cases"],
  ["sra", "10", "when specific performance of a contract can be ordered"], ["pca", "20", "presumption when a public servant accepts a gratification"], ["hma", "16", "legitimacy of children of void and voidable marriages"], ["stamp", "10", "who pays stamp duty"],
];
fs.mkdirSync(DIR, { recursive: true });
let made = 0, kept = 0;
for (const [k, n, hint, rep] of LIST) {
  const [title, id] = ACTS[k], file = `${DIR}/${k}-section-${n.padStart(3, "0")}.txt`;
  if (fs.existsSync(file)) { kept++; continue; }
  fs.writeFileSync(file, `# FILL-IN FILE: ${title}, section ${n}. Fill in the lines below, paste the section text under the last line, save.
# Topic hint (our own words, from memory, not checked): ${hint}.
# Leave the text area EMPTY to skip this file for now.${rep ? "\n# The data already holds WRONG text under this number, so this file replaces it." : ""}
Act: ${title}
Act ID: ${id}
Section: ${n}
Heading:
Replaces existing text: ${rep ? "yes" : "no"}
Source: India Code
Source URL:
Date copied:
=== SECTION TEXT (paste below this line) ===

`);
  made++;
}
console.log(`${made} files written, ${kept} already existed (left alone); ${LIST.length} in the list.`);
