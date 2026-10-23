import test from "node:test";
import assert from "node:assert/strict";
import { citedNumbers, sanitizeCitations, linkSegments } from "./citations.mjs";
import { extractLookups } from "./lookups.mjs";
import { buildChatPrompt, retrievalQuery, parseCheck, buildCheckPrompt, sourceBlock, SOURCE_CHARS } from "./prompt.mjs";
import { toBlocks } from "./format.mjs";
import { evaluateLimits, readLimits } from "./limits.mjs";
import limitConfig from "../../config/chat-limits.json" with { type: "json" };

const NI = "The Negotiable Instruments Act, 1881", CRPC = "The Code of Criminal Procedure, 1973", ICA = "The Indian Contract Act, 1872";
const sources = [{ n: 1, number: "138", actTitle: NI }, { n: 2, number: "142", actTitle: NI }, { n: 3, number: "438", actTitle: CRPC }, { n: 4, number: "11", actTitle: ICA }];

test("citedNumbers reads [1] [1, 2] [1][2] once each, in order", () => { assert.deepEqual(citedNumbers("a [2] b [1, 3] c [2][4]."), [2, 1, 3, 4]); assert.deepEqual(citedNumbers("no cites, but [x] and (1)"), []); });
test("sanitizeCitations removes sources that were never retrieved and keeps the valid part of a list", () => {
  const r = sanitizeCitations("Punishment is two years [1]. Fine too [7]. Both [1, 9].", 4);
  assert.equal(r.text, "Punishment is two years [1]. Fine too. Both [1]."); assert.deepEqual(r.invalid, [7, 9]);
  assert.equal(sanitizeCitations("Nothing [0] here [5].", 4).text, "Nothing here.");
  assert.deepEqual(sanitizeCitations("ok [1][2]", 2), { text: "ok [1][2]", invalid: [] });
});
test("linkSegments: [n] chips, and statute names linked only to the right retrieved section", () => {
  const segs = linkSegments("Under Section 138 of the Negotiable Instruments Act, 1881 the drawer is punished [1]. Section 142 of the NI Act sets the time [2][9].", sources);
  const kinds = segs.map((s) => (s.type === "text" ? "t" : s.type === "cite" ? `c${s.n}` : `s${s.n}`));
  assert.deepEqual(kinds.filter((k) => k !== "t"), ["s1", "c1", "s2", "c2"]);   // [9] is not a source: dropped
  assert.ok(segs.find((s) => s.type === "statute" && s.n === 1).text.startsWith("Section 138 of the Negotiable Instruments Act"));
  assert.equal(segs.map((s) => (s.type === "cite" ? "" : s.text)).join("").includes("[9]"), false);
});
test("linkSegments never links on a guess: same number in another Act, unknown Act, or two candidates without an Act name", () => {
  const two = [{ n: 1, number: "5", actTitle: "The Kerala Buildings Act" }, { n: 2, number: "5", actTitle: "The Karnataka Rent Act" }];
  assert.equal(linkSegments("See Section 5 for details.", two).some((s) => s.type === "statute"), false);                 // ambiguous
  assert.equal(linkSegments("Section 5 of the Contract Act applies.", two).some((s) => s.type === "statute"), false);        // Act not among the sources
  assert.equal(linkSegments("Section 138 of the Indian Penal Code applies.", sources).some((s) => s.type === "statute"), false); // right number, wrong Act
  assert.equal(linkSegments("Section 5 of the Karnataka Rent Act applies.", two).find((s) => s.type === "statute").n, 2);
  assert.equal(linkSegments("Section 438 of the CrPC allows it.", sources).find((s) => s.type === "statute").n, 3);          // alias
  assert.equal(linkSegments("Section 11 provides this.", sources).find((s) => s.type === "statute").n, 4);                 // one candidate, no Act named
});
test("extractLookups finds sections named inside a question", () => {
  assert.deepEqual(extractLookups("What does section 138 of the NI Act say about notice?"), ["138 NI Act"]);
  assert.deepEqual(extractLookups("Explain Section 438 of the Code of Criminal Procedure, 1973 and s. 154 of the CrPC"), ["438 Code of Criminal Procedure, 1973", "154 CrPC"]);
  assert.deepEqual(extractLookups("NI Act section 138 and the Indian Contract Act, section 10"), ["138 NI Act", "10 Indian Contract Act"]);
  assert.deepEqual(extractLookups("What is the punishment for cheque bounce?"), []);
});
test("buildChatPrompt puts sources with the newest question and keeps only recent history", () => {
  const hist = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
  const p = buildChatPrompt({ question: "Q?", history: hist, sources: [{ n: 1, actTitle: NI, number: "138", heading: "Dishonour", text: "text", inForce: false }] });
  assert.equal(p.messages.length, 9); assert.equal(p.messages.at(-1).role, "user");
  assert.ok(p.messages.at(-1).content.includes("[1] The Negotiable Instruments Act, 1881 [not in force] — Section 138 (Dishonour)")); assert.ok(p.messages.at(-1).content.endsWith("Question: Q?"));
  assert.ok(p.system.includes("ONLY from the numbered sources")); assert.ok(p.system.includes("judgments are not included yet"));
  assert.ok(buildChatPrompt({ question: "Q", sources: [] }).messages[0].content.includes("no sections were found"));
  assert.ok(sourceBlock({ n: 1, actTitle: "A", number: "1", text: "x".repeat(SOURCE_CHARS * 2) }).length < SOURCE_CHARS + 80);
});
test("retrievalQuery lets a very short follow-up borrow the previous question", () => {
  const h = [{ role: "user", content: "What is the punishment for cheque bounce?" }, { role: "assistant", content: "..." }];
  assert.equal(retrievalQuery("and for a company?", h), "What is the punishment for cheque bounce? and for a company?");
  assert.equal(retrievalQuery("What is the time limit for filing a cheque bounce complaint?", h), "What is the time limit for filing a cheque bounce complaint?");
  assert.equal(retrievalQuery("and for a company?", []), "and for a company?");
});
test("parseCheck: labels, fenced JSON, claims, and the cautious default for unreadable output", () => {
  assert.deepEqual(parseCheck('{"label":"supported","unsupported_claims":[]}'), { label: "supported", unsupported: [] });
  assert.deepEqual(parseCheck('```json\n{"label":"partial","unsupported_claims":["fine is 5 lakh"]}\n```'), { label: "partial", unsupported: ["fine is 5 lakh"] });
  assert.equal(parseCheck('{"label":"supported","unsupported_claims":["x"]}').label, "partial");      // "supported" with claims listed is not supported
  assert.equal(parseCheck('{"label":"unsupported","unsupported_claims":[]}').label, "check");
  assert.equal(parseCheck("sure, here you go: {\"label\":\"supported\",\"unsupported_claims\":[]}").label, "supported");
  const bad = parseCheck("I think it is fine"); assert.equal(bad.label, "check"); assert.equal(bad.unreadable, true);
  assert.equal(parseCheck('{"label":"banana"}').label, "check");
  assert.ok(buildCheckPrompt({ question: "q", answer: "a", sources: [{ n: 1, actTitle: NI, number: "138", text: "t" }] }).messages[0].content.includes("Answer to check:\na"));
});
test("toBlocks makes paragraphs and lists and drops markdown noise", () => {
  const b = toBlocks("**Punishment**\nUp to two years [1].\n\n- first point\n- second point\n\n1. step one\n2. step two\n\n## Heading\nEnd.");
  assert.deepEqual(b.map((x) => x.type), ["p", "ul", "ol", "p"]);
  assert.equal(b[0].text, "Punishment Up to two years [1]."); assert.deepEqual(b[1].items, ["first point", "second point"]); assert.equal(b[3].text, "Heading End.");
});
test("limits: daily, weekly and global monthly each stop a question with a clear message; config and env overrides", () => {
  const L = { daily: 30, weekly: 150, monthlyGlobal: 3000 };
  assert.equal(evaluateLimits({ day: 29, week: 100, month: 10 }, L).allowed, true);
  assert.equal(evaluateLimits({ day: 29, week: 100, month: 10 }, L).remainingToday, 0);
  assert.deepEqual([evaluateLimits({ day: 30, week: 30, month: 30 }, L).reason, evaluateLimits({ day: 5, week: 150, month: 30 }, L).reason, evaluateLimits({ day: 5, week: 5, month: 3000 }, L).reason], ["daily", "weekly", "monthly"]);
  assert.match(evaluateLimits({ day: 30, week: 30, month: 30 }, L).message, /30 questions/);
  assert.deepEqual(readLimits(limitConfig, {}), { daily: 30, weekly: 150, monthlyGlobal: 3000 });
  assert.deepEqual(readLimits(limitConfig, { CHAT_LIMIT_DAILY: "5", CHAT_LIMIT_WEEKLY: "oops", CHAT_LIMIT_MONTHLY_GLOBAL: "-1" }), { daily: 5, weekly: 150, monthlyGlobal: 3000 });
});
