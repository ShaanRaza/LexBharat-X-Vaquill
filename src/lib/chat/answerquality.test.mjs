// Answer quality: questions that need two Acts, old law vs new law, and plain-language questions (Oct 30). General rules only: no test names a question of the evaluation sets.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ensureActShare, namesAct } from "./share.mjs";
import { counterparts, counterpartsOfLookup, lookupFor, mappingNote, MAPPING_ADDENDUM, mentions, missingMentions, pairsOf, pairsOfNamed, usableTitle, citeFinder, actSide } from "./concordance.mjs";
import { conceptHint, conceptMatches, conceptQueries } from "./concepts.mjs";
import { buildRewritePrompt, REWRITE_SYSTEM } from "./rewrite.mjs";
import { answerFirst, sentences } from "./shape.mjs";
import { buildChatPrompt, SYSTEM_PROMPT } from "./prompt.mjs";
import map from "../../config/law-mapping.json" with { type: "json" };
import concepts from "../../config/concept-acts.json" with { type: "json" };

// ---- Class 1: a share of the sections for every Act the rewrite named
const acts = { a1: { id: "A", title: "The Limitation Act, 1963" }, a2: { id: "A", title: "The Limitation Act, 1963" }, a3: { id: "A", title: "The Limitation Act, 1963" }, a4: { id: "A", title: "The Limitation Act, 1963" }, b1: { id: "B", title: "The Arbitration and Conciliation Act, 1996" }, b2: { id: "B", title: "The Arbitration and Conciliation Act, 1996" }, c1: { id: "C", title: "The Indian Contract Act, 1872" } };
const actOf = (k) => acts[k];
test("namesAct: a query names an Act when it uses most of the Act's own words", () => {
  assert.equal(namesAct("Limitation Act period of limitation for a suit", "The Limitation Act, 1963"), true);
  assert.equal(namesAct("Arbitration and Conciliation Act section 43", "The Arbitration and Conciliation Act, 1996"), true);
  assert.equal(namesAct("limitation period applicability to arbitration proceedings", "The Arbitration and Conciliation Act, 1996"), false);   // names a subject, not the Act
});
test("per-Act minimum: the strongest Act cannot take every place when the rewrite named two Acts", () => {
  const lists = [["a1", "a2", "a3", "a4"], ["a1", "a2"], ["b1", "b2"]], queries = ["a question", "Limitation Act period of limitation", "Arbitration and Conciliation Act section 43"];
  const merged = ["a1", "a2", "a3", "a4"];
  const out = ensureActShare(merged, lists, queries, actOf, { limit: 4, min: 2 });
  assert.equal(out.length, 4); assert.equal(out.filter((k) => acts[k].id === "B").length, 2); assert.equal(out.filter((k) => acts[k].id === "A").length, 2);
});
test("per-Act minimum: exact lookups are kept, and nothing changes for a one-Act question", () => {
  const lists = [["a1", "a2", "a3"], ["a1", "a4"]], queries = ["q", "Limitation Act period"];
  const merged = ["a1", "a2", "a3", "a4"];
  assert.deepEqual(ensureActShare(merged, lists, queries, actOf, { limit: 4, min: 2 }), merged);   // one Act: unchanged
  const two = ensureActShare(["a1", "a2", "a3", "a4"], [["a1"], ["b1", "b2"]], ["q", "Arbitration and Conciliation Act arbitral award"], actOf, { limit: 4, min: 2, protect: ["a1", "a2"] });
  assert.ok(two.includes("a1") && two.includes("a2")); assert.ok(two.filter((k) => acts[k].id === "B").length >= 1);
  assert.ok(ensureActShare(["a1"], [["a1"]], ["Limitation Act"], actOf).length === 1);
});
test("per-Act minimum: an Act a query did not actually name gets no reserved places", () => {
  const out = ensureActShare(["a1", "a2", "a3"], [["a1", "a2", "a3"], ["c1"]], ["Limitation Act section 3", "something about money"], actOf, { limit: 3, min: 2 });
  assert.deepEqual(out, ["a1", "a2", "a3"]);
});
test("the rewrite is told to split a multi-Act question into one query per Act or issue", () => {
  assert.match(REWRITE_SYSTEM, /MORE THAN ONE Act or legal issue/); assert.match(REWRITE_SYSTEM, /ONE query for EACH/); assert.match(REWRITE_SYSTEM, /2 to 4 queries/);
});
test("the answer prompt tells the model to address each part and to say which part is not covered", () => { assert.match(SYSTEM_PROMPT, /EACH part in turn/); assert.match(SYSTEM_PROMPT, /which part the sources do not cover/); });

// ---- Class 2: old law and new law, from the one mapping file; answers may name a confirmed pairing, and say when a text is not in our data
test("the mapping reader uses only confirmed pairings, never an unconfirmed row", () => {
  const unconfirmed = map.rows.find((r) => r.pairing_confirmed !== true);
  assert.ok(unconfirmed, "the file has unconfirmed rows to test with");
  const num = unconfirmed.old_section.replace(/\(.*/, ""), title = map.laws[unconfirmed.old_law].name;
  const found = counterparts({ actTitle: title, number: num }).filter((p) => p.number === String(unconfirmed.new_section));
  assert.deepEqual(found, [], `${unconfirmed.old_law} ${num} must not be offered`);
});
test("both directions: IPC words find the BNS section, BNS words find the IPC section (murder, theft)", () => {
  assert.deepEqual(counterpartsOfLookup("302 IPC").map(lookupFor), ["103 BNS"]);
  assert.deepEqual(counterpartsOfLookup("103 BNS").map(lookupFor), ["302 IPC"]);
  assert.ok(counterpartsOfLookup("379 IPC").some((p) => p.number.startsWith("303")));
  assert.deepEqual(counterpartsOfLookup("303 BNS").map((p) => p.number).sort(), ["378", "379"]);
  assert.deepEqual(counterpartsOfLookup("154 CrPC").map(lookupFor), ["173 BNSS"]);
  assert.deepEqual(counterpartsOfLookup("65B Evidence Act").map(lookupFor), ["63 BSA"]);
  assert.equal(actSide("The Indian Penal Code, 45 of 1860 (Rep., Act 45 of 2023)").side, "old"); assert.equal(actSide("The Code of Criminal Procedure (Amendment) Act, 2005"), null);
});
test("a section missing from our data is still named from the table, and the answer says its text is not held", () => {
  const [p] = pairsOfNamed(["34 IPC"]);
  assert.equal(p.self.textInData, false); assert.match(p.partner.number, /^3/);
  assert.match(mappingNote([p]), /text of IPC section 34 is not in our data/);
  const [line] = missingMentions("Common intention is dealt with in the new Sanhita.", [p]);
  assert.match(line.line, /Its text is not in our data yet|section 3/);
  assert.match(MAPPING_ADDENDUM("x"), /never describe a section whose text you were not given/);
});
test("the answer names BOTH laws: the counterpart is added from the table when the answer leaves it out", () => {
  const sources = [{ n: 1, actTitle: "The Bharatiya Nyaya Sanhita, 2023", number: "103", heading: "Punishment for murder" }, { n: 2, actTitle: "The Indian Penal Code, 45 of 1860 (Rep., Act 45 of 2023)", number: "302", heading: "Punishment for murder" }];
  const pairs = pairsOf(sources.slice(0, 1));
  assert.deepEqual(pairs.map((x) => x.partner.number), ["302"]);
  const bare = "Murder is punished with death or imprisonment for life [1].";
  const add = missingMentions(bare, pairs, citeFinder(sources));
  assert.equal(add.length, 1); assert.match(add[0].line, /old law this replaced: section 302 of the Indian Penal Code, 1860 \(Punishment for murder\) \[2\]/);
  assert.equal(missingMentions("Section 103 of the Bharatiya Nyaya Sanhita, 2023 replaced Section 302 of the Indian Penal Code [1].", pairs).length, 0);
  assert.equal(mentions("previously IPC 302", pairs[0].partner), true); assert.equal(mentions("IPC section 304", pairs[0].partner), false);
  const sys = buildChatPrompt({ question: "q", sources: sources.map((s) => ({ ...s, text: "t", year: 2023, inForce: true })), mapping: MAPPING_ADDENDUM(mappingNote(pairs)) }).system;
  assert.match(sys, /CURRENT law \(in force from 1 July 2024\)/); assert.match(sys, /replaced section 302 of the Indian Penal Code, 1860/);
});
test("a heading that is really amendment text or a run-on sentence is never printed as a section title", () => {
  assert.equal(usableTitle("Theft . — Whoever, intending to take dishonestly"), "Theft");
  assert.equal(usableTitle("Subs. by Act 30 of 2001, s. 3"), null); assert.equal(usableTitle("The Government of India considered it expedient and necessary to review the existing criminal laws"), null);
  assert.equal(usableTitle("Punishment for murder"), "Punishment for murder");
});
test("shaping: the 'couldn't find' line is not cut at 'v.', and stays first when only judgment excerpts follow", () => {
  const t = "I couldn't find what the US Supreme Court decided in Miranda v. Arizona in the Acts I searched. However, the case is mentioned in State v. Sandhu [3].";
  assert.equal(sentences(t).length, 2); assert.equal(sentences("Under s. 138 of the NI Act the notice is 30 days [1]. Dr. A. K. Sharma v. State held so [2].").length, 2);
  assert.equal(answerFirst(t, [{ n: 3, kind: "judgment" }]), t);
  assert.match(answerFirst("I couldn't find the penalty. However, Section 138 says up to two years [1].", [{ n: 1 }]), /^Section 138 says up to two years \[1\]\.\n\nI couldn't find the penalty\.$/);
});

// ---- Class 3: everyday words -> the Act that usually applies
test("the rewrite always gets the likely Acts for everyday words, and retrieval gets a query that names the Act", () => {
  const q = "My husband beats me. What law protects me?";
  assert.match(conceptHint(q), /Protection of Women from Domestic Violence Act, 2005/);
  assert.match(buildRewritePrompt({ question: q, hint: conceptHint(q) }).messages[0].content, /Acts that usually apply/);
  assert.ok(conceptQueries(q, 2).some((x) => /Protection of Women from Domestic Violence Act/.test(x)));
  assert.equal(conceptHint("What is the meaning of life?"), "");
});
test("concept hints cover the common areas, one entry per concept, each naming an Act and a query that names it", () => {
  const areas = new Set(concepts.concepts.map((c) => c.area));
  for (const a of ["family", "tenancy", "consumer", "workplace", "cheque", "property", "criminal"]) assert.ok(areas.has(a), a);
  for (const c of concepts.concepts) { assert.ok(c.act && c.query && c.when.length, c.id); assert.ok(namesAct(c.query, c.act), `${c.id}: the query must name its Act`); }
  assert.equal(new Set(concepts.concepts.map((c) => c.id)).size, concepts.concepts.length);
});
test("class: no concept hint, mapping row or code path is keyed to a question number or wording of the evaluation sets", () => {
  const files = ["src/lib/chat/concepts.mjs", "src/lib/chat/concordance.mjs", "src/lib/chat/share.mjs", "src/config/concept-acts.json"];
  const questions = [...JSON.parse(fs.readFileSync("docs/eval/questions-hard.json", "utf8")).questions, ...JSON.parse(fs.readFileSync("docs/eval/questions-heldout.json", "utf8")).questions, ...JSON.parse(fs.readFileSync("docs/eval/questions.json", "utf8")).questions];
  for (const f of files) { const t = fs.readFileSync(f, "utf8").toLowerCase(); for (const q of questions) assert.ok(!t.includes(String(q.question).toLowerCase().slice(0, 40)), `${f} contains the wording of question ${q.id}`); }
});
