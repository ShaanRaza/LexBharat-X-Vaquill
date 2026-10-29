import test from "node:test";
import assert from "node:assert/strict";
import { tuningFlags } from "./tuning.mjs";
import { currentLawFirst, pairFor, REPLACED_ADDENDUM } from "./currentlaw.mjs";
import { verifyCitations } from "./verify.mjs";
import { buildRewritePrompt, REWRITE_SYSTEM, STATUTORY_ADDENDUM, mergeHybrid } from "./rewrite.mjs";
import { extractLookups } from "./lookups.mjs";
import { buildChatPrompt, sourceBlock } from "./prompt.mjs";
import cfg from "../../config/chat-tuning.json" with { type: "json" };
import replaced from "../../config/replaced-laws.json" with { type: "json" };

test("only the switches that raised the score are on in the shipped config", () => { assert.deepEqual(tuningFlags(cfg, {}), { hybridSearch: true, statutoryRewrite: true, currentLaw: false, citationCheck: false }); });
test("an environment variable forces one switch on or off; other values use the config", () => {
  assert.equal(tuningFlags({}, { CHAT_TUNING_CURRENT_LAW: "1" }).currentLaw, true);
  assert.equal(tuningFlags({ citationCheck: true }, { CHAT_TUNING_CITATION_CHECK: "0" }).citationCheck, false);
  assert.equal(tuningFlags({ hybridSearch: true }, { CHAT_TUNING_HYBRID_SEARCH: "maybe" }).hybridSearch, true);
  assert.equal(tuningFlags({}, { CHAT_TUNING_HYBRID_SEARCH: "true" }).hybridSearch, true);
});

test("statutory rewrite adds the Hinglish / current-law rules only when asked", () => {
  const off = buildRewritePrompt({ question: "cheque bounce ho gaya kya karu" }), on = buildRewritePrompt({ question: "cheque bounce ho gaya kya karu", statutory: true });
  assert.equal(off.system, REWRITE_SYSTEM); assert.equal(on.system, REWRITE_SYSTEM + STATUTORY_ADDENDUM);
  assert.match(on.system, /Hinglish/); assert.match(on.system, /Bharatiya Nyaya Sanhita/); assert.equal(off.messages[0].content, on.messages[0].content);
});

const hit = (actId, actTitle, number, inForce = true) => ({ actId, sectionKey: number, actTitle, number, actStatus: inForce ? "in_force" : "repealed" });
const IPC = "The Indian Penal Code, 45 of 1860 (Rep., Act 45 of 2023)", BNS = "The Bharatiya Nyaya Sanhita, 2023", NI = "The Negotiable Instruments Act, 1881";
test("pairFor matches the old Act by the start of its title, not a lookalike", () => {
  assert.equal(pairFor(IPC, replaced.pairs).new, "the bharatiya nyaya sanhita");
  assert.equal(pairFor("The Code of Criminal Procedure, 1973", replaced.pairs).label, "The Bharatiya Nagarik Suraksha Sanhita, 2023");
  assert.equal(pairFor("The Code of Criminal Procedure (Amendment) Act, 2005", replaced.pairs)?.old ?? null, "the code of criminal procedure");   // an amending Act of the same name is still the old law family
  assert.equal(pairFor(BNS, replaced.pairs), null); assert.equal(pairFor(NI, replaced.pairs), null);
});
test("current law first: the replacement leads, the old section is marked and kept after it", () => {
  const picked = [hit("ipc", IPC, "379", false), hit("bns", BNS, "303"), hit("bns", BNS, "305"), hit("ni", NI, "138")];
  const out = currentLawFirst(picked, picked, replaced.pairs, { k: 10 });
  assert.deepEqual(out.map((h) => h.number), ["303", "305", "138", "379"]);
  assert.equal(out[3].replacedBy, "The Bharatiya Nyaya Sanhita, 2023"); assert.equal(out[0].replacedBy, undefined);
});
test("current law first: pulls the replacement in from the wider pool when only the old section was picked", () => {
  const picked = [hit("ipc", IPC, "302", false)], pool = [hit("ipc", IPC, "302", false), hit("bns", BNS, "103"), hit("bns", BNS, "104"), hit("bns", BNS, "105")];
  const out = currentLawFirst(picked, pool, replaced.pairs, { k: 10 });
  assert.deepEqual(out.map((h) => h.number), ["103", "104", "302"]); assert.equal(out[2].replacedBy, "The Bharatiya Nyaya Sanhita, 2023");
});
test("current law first: no replacement available -> nothing changes (the old section is not marked)", () => {
  const picked = [hit("ipc", IPC, "379", false), hit("ni", NI, "138")];
  assert.deepEqual(currentLawFirst(picked, picked, replaced.pairs), picked);
  assert.deepEqual(currentLawFirst([hit("bns", BNS, "303")], [], replaced.pairs).length, 1);
});
test("the prompt marks a replaced source and adds the 'previously ...' rule only then", () => {
  const src = (extra = {}) => ({ n: 1, actTitle: IPC, inForce: false, number: "379", heading: "Punishment for theft", text: "x", ...extra });
  assert.match(sourceBlock(src({ replacedBy: "The Bharatiya Nyaya Sanhita, 2023" })), /\[not in force; replaced by The Bharatiya Nyaya Sanhita, 2023\]/);
  assert.match(sourceBlock(src()), /\[not in force\]/);
  assert.ok(buildChatPrompt({ question: "q", sources: [src({ replacedBy: "B" })] }).system.includes(REPLACED_ADDENDUM));
  assert.ok(!buildChatPrompt({ question: "q", sources: [src()] }).system.includes(REPLACED_ADDENDUM));
});

const S = [
  { n: 1, actTitle: NI, number: "138", heading: "Dishonour of cheque", text: "Where any cheque drawn by a person on an account maintained by him with a banker is returned by the bank unpaid, because of insufficient funds, such person shall be punished with imprisonment up to two years." },
  { n: 2, actTitle: NI, number: "142", heading: "Cognizance of offences", text: "The court shall take cognizance of a complaint made in writing by the payee within one month of the date on which the cause of action arises." },
];
test("citation check moves a number to the source that actually says it, and leaves good citations alone", () => {
  const r = verifyCitations("The complaint must be made in writing within one month of the cause of action arising [1]. A cheque returned unpaid for insufficient funds is punishable with imprisonment [1].", S);
  assert.equal(r.text, "The complaint must be made in writing within one month of the cause of action arising [2]. A cheque returned unpaid for insufficient funds is punishable with imprisonment [1].");
  assert.deepEqual(r.swaps.map((x) => [x.from, x.to]), [[1, 2]]);
});
test("citation check does nothing when no other source clearly fits, when the sentence is short, or when the number is not a source", () => {
  assert.equal(verifyCitations("Pay the amount soon [1].", S).text, "Pay the amount soon [1].");
  assert.equal(verifyCitations("Unrelated words about gardening tomatoes carefully [2].", S).text, "Unrelated words about gardening tomatoes carefully [2].");
  assert.equal(verifyCitations("No citation here at all.", S).text, "No citation here at all.");
  assert.equal(verifyCitations("The complaint must be made in writing within one month [9].", S).text, "The complaint must be made in writing within one month [9].");
});
test("citation check keeps a list tidy when two numbers collapse into one", () => {
  const r = verifyCitations("The complaint must be made in writing within one month of the date the cause of action arises [1, 2].", S);
  assert.equal(r.text, "The complaint must be made in writing within one month of the date the cause of action arises [1, 2].");   // [2] already cited and fits; [1] only moves to a source not already cited
});

test("bare short names with a number are section lookups: IPC 420, 302 IPC, BNS 318; years are not", () => {
  assert.deepEqual(extractLookups("IPC 420 cheating punishment"), ["420 IPC"]);
  assert.deepEqual(extractLookups("what is 302 IPC"), ["302 IPC"]);
  assert.deepEqual(extractLookups("BNS 318 and BNSS 482"), ["318 BNS", "482 BNSS"]);
  assert.deepEqual(extractLookups("the BNS 2023 replaced the IPC"), []);
  assert.deepEqual(extractLookups("What does section 138 of the NI Act say?"), ["138 NI Act"]);   // the older patterns still work
});
test("the statutory rewrite tells the model to keep the user's own Acts, numbers and each part of the question", () => { assert.match(STATUTORY_ADDENDUM, /own query/); assert.match(STATUTORY_ADDENDUM, /IPC 420/); });
test("hybrid merge: keyword hits boost but never outrank meaning/exact matches; at most two keyword-only ones go last", () => {
  const sem = [["a", "b", "c", "d"]], kw = [["x", "d", "y", "z"]];
  const out = mergeHybrid(sem, kw, 6, []);
  assert.deepEqual(out.slice(-2), ["x", "y"]); assert.equal(out.indexOf("d") < out.indexOf("x"), true); assert.equal(out.includes("z"), false);
  assert.deepEqual(mergeHybrid(sem, kw, 6, ["e"])[0], "e");           // exact lookups stay first
  assert.deepEqual(mergeHybrid([["a", "b"]], [], 5), ["a", "b"]);       // no keyword lists: the plain merge
});
