import test from "node:test";
import assert from "node:assert/strict";
import { CONTRACT_TYPES, lawPlan, missingClauses, quoteInText, sideOk, splitParts, TOPICS } from "./rules.mjs";
import { mergeMissing, overallRisk, parseClauses, parseLaw, parseSummary, partPrompt, lawPrompt } from "./prompts.mjs";
import { reviewToBlocks } from "./blocks.mjs";
import { buildDocx, buildPdf } from "../drafting/export.mjs";
import { buildChatPrompt, sourceBlock, DOC_ADDENDUM } from "../chat/prompt.mjs";

const NDA = "4. Non-compete\n4.1 The Receiving Party shall not carry on any competing business anywhere in India for five years.\n5. Penalty\n5.1 On any breach it shall pay a penalty of Rs. 50,00,000 without proof of loss.\n7. Governing law\n7.1 Governed by the laws of England and Wales; courts of London.";

test("contract types and sides", () => { assert.equal(sideOk("nda", "Receiving party"), true); assert.equal(sideOk("nda", "Landlord / licensor"), false); assert.equal(sideOk("zzz", "x"), false); assert.equal(Object.keys(CONTRACT_TYPES).length, 5); });
test("law plan finds s.27, s.74 and the foreign-law section from the words, and adds rent law by type and state", () => {
  const p = lawPlan(NDA, "nda");
  assert.ok(p.lookups.includes("27 Indian Contract Act") && p.lookups.includes("74 Indian Contract Act") && p.lookups.includes("28 Indian Contract Act"));
  const r = lawPlan("Leave and licence at Mumbai, Maharashtra. Eleven months.", "rent");
  assert.ok(r.lookups.includes("17 Registration Act") && r.lookups.includes("36A Maharashtra Stamp Act") && r.state === "maharashtra");
  assert.ok(!lawPlan("This is an ordinary lease of a shop in Madurai.", "other").lookups.includes("27 Indian Contract Act"));
  assert.ok(TOPICS.every((t) => t.lookups.every((l) => /^\d+[A-Z]? [A-Z]/.test(l))));
});
test("missing clauses are reported only when the words are really absent", () => {
  const rent = "Licence for eleven months. Licence fee Rs 45,000. Maintenance and electricity are paid by the licensee. Disputes go to the courts at Mumbai.";
  const m = missingClauses("rent", rent).map((x) => x.clause);
  assert.ok(m.includes("Registration of the agreement") && m.includes("Stamp duty"));
  assert.ok(!missingClauses("rent", rent + " This agreement shall be registered and stamped.").map((x) => x.clause).some((c) => /Registration|Stamp/.test(c)));
});
test("a long contract is cut between clauses, every part within the size", () => {
  const text = Array.from({ length: 30 }, (_, i) => `${i + 1}. Clause ${i + 1}\n${"The parties agree to the terms of this clause. ".repeat(12)}`).join("\n");
  const parts = splitParts(text, 3000);
  assert.ok(parts.length > 3 && parts.every((p) => p.text.length <= 3000)); assert.equal(parts.map((p) => p.text).join("").replace(/\s/g, ""), text.replace(/\s/g, ""));
  assert.equal(splitParts("short contract text here", 8000).length, 1);
});
test("quotes must really be in the text", () => { assert.equal(quoteInText("shall not carry on any competing business", NDA), true); assert.equal(quoteInText("shall never ever compete worldwide forever", NDA), false); assert.equal(quoteInText("too short", NDA), false); });
test("clause JSON is clamped, quotes checked, bad entries dropped", () => {
  const raw = JSON.stringify({ clauses: [
    { ref: "4.1", quote: "The Receiving Party shall not carry on any competing business anywhere in India", risk: "escalate", reason: "Five years across India is a wide restraint.", change: { wording: "For 12 months, within the city.", why: "More defensible." }, topics: ["non_compete", "bogus"] },
    { ref: "9", quote: "text that is not in the contract at all", risk: "acceptable", reason: "Fine.", change: { wording: "x", why: "y" } },
    { ref: "", risk: "negotiate", reason: "no ref" }, { ref: "2", risk: "weird", reason: "x" }] });
  const c = parseClauses(raw, NDA);
  assert.equal(c.length, 2); assert.equal(c[0].quoteMatched, true); assert.deepEqual(c[0].topics, ["non_compete"]); assert.equal(c[1].quote, ""); assert.equal(c[1].change, null);
  assert.equal(parseClauses("not json", NDA), null); assert.equal(parseClauses("```json\n{\"clauses\":[]}\n```", NDA).length, 0);
});
test("overall risk is never lower than the clauses imply; missing clauses merge without repeats", () => {
  assert.equal(overallRisk("low", [{ risk: "escalate" }]), "medium"); assert.equal(overallRisk("low", [{ risk: "escalate" }, { risk: "negotiate" }, { risk: "negotiate" }, { risk: "negotiate" }]), "high");
  assert.equal(overallRisk("high", [{ risk: "acceptable" }]), "high"); assert.equal(overallRisk(null, []), "low");
  assert.equal(mergeMissing([{ clause: "Stamp duty clause", why: "a" }, { clause: "Force majeure", why: "b" }], [{ clause: "Stamp duty", why: "c" }]).length, 2);
  assert.equal(parseSummary("{\"what\":\"NDA\",\"overallRisk\":\"extreme\"}").overallRisk, null);
});
test("law points need a retrieved citation and may not name sections that were not retrieved", () => {
  const src = [{ n: 1, number: "27", actTitle: "The Indian Contract Act, 1872" }, { n: 2, number: "74", actTitle: "The Indian Contract Act, 1872" }];
  const raw = JSON.stringify({ findings: [
    { topic: "Restraint", clause: "4.1", severity: "issue", text: "Section 27 of the Indian Contract Act, 1872 makes such agreements void [1].", cites: [1] },
    { topic: "No cite", severity: "issue", text: "This is unlawful." },
    { topic: "Invented", severity: "issue", text: "Section 999 of the Indian Contract Act, 1872 says so [1]." },
    { topic: "Bad number", severity: "check", text: "See the penalty rule [7]." }] });
  const r = parseLaw(raw, src);
  assert.equal(r.findings.length, 1); assert.equal(r.findings[0].topic, "Restraint"); assert.deepEqual(r.findings[0].cites, [1]); assert.equal(r.dropped, 3); assert.equal(parseLaw("nope", src), null);
});
test("prompts carry the side, the part and only the text; the law prompt lists numbered sources", () => {
  const p = partPrompt({ type: "nda", side: "Receiving party", partText: NDA, n: 1, of: 2 });
  assert.match(p.messages[0].content, /Receiving party/); assert.match(p.messages[0].content, /part 1 of 2/); assert.match(p.system, /JSON only/);
  const l = lawPrompt({ type: "nda", side: "x", issues: [], sources: [{ n: 1, actTitle: "The Indian Contract Act, 1872", state: null, number: "27", heading: "Agreements in restraint of trade", text: "Every agreement ... void." }] });
  assert.match(l.messages[0].content, /\[1\] The Indian Contract Act, 1872 — Section 27/);
});
test("document passages are marked in the chat prompt and the prompt gains the document rules", () => {
  const doc = { n: 1, kind: "doc", docName: "NDA.pdf", page: 2, label: "4. Non-compete", actTitle: "NDA.pdf", number: null, text: "Five years." }, act = { n: 2, actTitle: "The Indian Contract Act, 1872", number: "27", text: "void" };
  assert.match(sourceBlock(doc), /^\[1\] YOUR DOCUMENT "NDA\.pdf" — page 2, 4\. Non-compete/);
  assert.ok(buildChatPrompt({ question: "q", sources: [doc, act] }).system.includes(DOC_ADDENDUM)); assert.ok(!buildChatPrompt({ question: "q", sources: [act] }).system.includes(DOC_ADDENDUM));
});
test("a review becomes blocks and exports to docx and pdf", async () => {
  const run = { docName: "nda.pdf", contractType: "nda", side: "Receiving party", result: { risk: "high",
    summary: { status: "ok", value: { what: "A mutual NDA.", parties: ["Alpha (Disclosing)", "Beta (Receiving)"], term: "2 years", money: "Rs 50 lakh penalty", governingLaw: "India, Delhi courts", overallRisk: "high", overallWhy: "Wide restraint." } },
    parts: [{ i: 0, status: "ok", clauses: [{ ref: "4.1", quote: "shall not carry on", quoteMatched: true, risk: "escalate", reason: "Wide restraint ₹.", change: { wording: "Limit to 12 months.", why: "Defensible." } }] }, { i: 1, status: "failed" }],
    missing: [{ clause: "Return of materials", why: "Not stated.", source: "check" }],
    law: { status: "ok", findings: [{ topic: "Restraint of trade", clause: "4.1", severity: "issue", text: "Section 27 of the Indian Contract Act makes it void [1].", cites: [1] }], sources: [{ n: 1, actTitle: "The Indian Contract Act, 1872", number: "27" }], dropped: 0 }, models: [] } };
  const blocks = reviewToBlocks(run);
  assert.ok(blocks.some((b) => b.type === "heading" && b.runs[0].text === "Indian law points")); assert.ok(JSON.stringify(blocks).includes("Part 2 of the contract were not reviewed") || JSON.stringify(blocks).includes("Parts 2") || JSON.stringify(blocks).includes("Part 2"));
  const docx = await buildDocx(blocks, { title: "t" }), pdf = await buildPdf(blocks, { title: "t" });
  assert.equal(Buffer.from(docx.subarray(0, 2)).toString(), "PK"); assert.equal(Buffer.from(pdf.subarray(0, 4)).toString(), "%PDF");
});
