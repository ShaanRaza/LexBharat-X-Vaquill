#!/usr/bin/env node
// Writes docs/eval/questions-hard-review.txt (the plain-text version of docs/eval/questions-hard.json for the lawyer). usage: node scripts/eval/review-txt.mjs
import fs from "node:fs";
const d = JSON.parse(fs.readFileSync("docs/eval/questions-hard.json", "utf8"));
let o = "LEXBHARAT HARD EVALUATION QUESTIONS - FOR LAWYER REVIEW (draft, written by Claude, not yet checked)\nFor each: the question as a user would type it, the section(s) the answer should rest on, and a note. Please mark each OK / change / remove.\n\n";
for (const x of d.questions) {
  o += `${x.id}. [${x.kind}] ${x.question}\n`;
  if (x.expect === "notfound") o += "   Expected: the answer should say the sources do not contain this (no invented law).\n";
  else for (const g of x.golds) o += `   Expected: ${g.act.replace(/,.*/, "")} - section ${g.section}${g.alts?.length ? ` (also accepted: ${g.alts.map((a) => `${a.act.replace(/,.*/, "").replace(/^The /, "")} s.${a.section}`).join("; ")})` : ""}\n`;
  if (x.mustMention) o += `   The answer must mention: ${x.mustMention.join(", ")}\n`;
  if (x.forbid) o += `   The answer must NOT cite: ${x.forbid.map((f) => `${f.act.replace(/^The /, "")} s.${f.numbers.join(", ")}`).join("; ")}\n`;
  if (x.oldLaw) o += `   Old-law rule: answer from the current law and say it was previously IPC s.${x.oldLaw}\n`;
  if (x.skip) o += `   NOT SCORED YET: ${x.skip}\n`;
  o += `   Note: ${x.review}\n\n`;
}
o += "General checks on every question: an answer that opens with \"I couldn't find...\" although the source answers it is marked not right.\n";
fs.writeFileSync("docs/eval/questions-hard-review.txt", o); console.log(`wrote ${d.questions.length} questions`);
