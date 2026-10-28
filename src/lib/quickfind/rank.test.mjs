import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { isFullCitation, numericOk, parseQuick, popularKey, rankNumbered, resolveActs, titlePrefixes, toRoman, unitReadable } from "./rank.mjs";

const cfg = JSON.parse(fs.readFileSync(new URL("../../config/quickfind.json", import.meta.url), "utf8"));
const row = (actTitle, number, extra = {}) => ({ actTitle, number, category: "central", actStatus: "in_force", ...extra });
const NI = "The Negotiable Instruments Act, 1881", IPC = "The Indian Penal Code, 45 of 1860 (Rep., Act 45 of 2023)", BNS = "The Bharatiya Nyaya Sanhita, 2023", CONST = "The Constitution of India";

test("1. a bare number is a number; words are text", () => {
  for (const [q, n] of [["138", "138"], ["302", "302"], ["21", "21"], ["43A", "43A"], ["43a", "43A"], ["498A", "498A"]]) assert.deepEqual(parseQuick(q, cfg), { kind: "number", number: n }, q);
  for (const q of ["cheque bounce", "negotiable", "ni act", "2014 INSC 514", "banana 138"]) assert.equal(parseQuick(q, cfg).kind === "number", false, q);
  assert.equal(parseQuick("banana 138", cfg).kind, "text");
});
test("1. for a bare number the well-known Act comes first (NI 138, IPC then BNS 302, Constitution Article 21), then the popular Acts, then the rest", () => {
  const rows138 = [row("The Manipur Land Act", "138", { category: "state" }), row("The Code of Civil Procedure, 1908", "138"), row("The Limitation Act, 1963", "138"), row(NI, "138"), row("The Companies Act, 2013", "138")];
  assert.equal(rankNumbered(rows138, "138", cfg)[0].actTitle, NI);
  assert.deepEqual(rankNumbered(rows138, "138", cfg).slice(1, 3).map((r) => r.actTitle), ["The Code of Civil Procedure, 1908", "The Limitation Act, 1963"]);   // popular Acts in the listed order
  assert.equal(rankNumbered(rows138, "138", cfg).at(-1).actTitle, "The Manipur Land Act");   // a State Act is last
  const rows302 = [row("The Customs Act, 1962", "302"), row(BNS, "302"), row(IPC, "302", { actStatus: "repealed" })];
  assert.deepEqual(rankNumbered(rows302, "302", cfg).slice(0, 2).map((r) => r.actTitle), [IPC, BNS]);   // a repealed popular Act (IPC) still beats an in-force unknown one
  const rows21 = [row(NI, "21"), row(CONST, "A21"), row("The Contract Act", "21", { actTitle: "The Indian Contract Act, 1872" })];
  assert.equal(rankNumbered(rows21, "21", cfg)[0].actTitle, CONST);   // Article 21 before NI s.21
  const rows43A = [row("The Zebra Act", "43A"), row("The Information Technology Act, 2000", "43A")];
  assert.equal(rankNumbered(rows43A, "43A", cfg)[0].actTitle, "The Information Technology Act, 2000");   // no well-known entry: popular order, then the rest
});
test("State copies of a popular Act's title are never ranked as popular", () => {
  assert.equal(popularKey("The Constitution of India", "state", cfg), null); assert.equal(popularKey("The Constitution of India", "central", cfg), "constitution");
  const rows = [row(CONST, "A21", { category: "state" }), row(CONST, "A21")];
  assert.equal(rankNumbered(rows, "21", cfg)[0].category, "central");
});
test("2. '138 NI', 's.138 NI Act', 'NI 138', 'section 138 negotiable', '138 NI Act' all mean NI Act section 138", () => {
  for (const q of ["138 NI", "s.138 NI Act", "NI 138", "section 138 negotiable", "138 NI Act", "138 of the NI Act", "sec 138 negotiable instruments", "ni act 138", "S. 138 NI"]) assert.deepEqual(parseQuick(q, cfg), { kind: "act-number", number: "138", acts: ["ni"] }, q);
});
test("2. the short names resolve: NI Act, CPC, CrPC, IPC, BNS, BNSS, BSA, IT Act, GST", () => {
  const want = { "ni act": "ni", cpc: "cpc", crpc: "crpc", "cr pc": "crpc", ipc: "ipc", bns: "bns", bnss: "bnss", bsa: "bsa", "it act": "it", it: "it", gst: "gst", cgst: "gst", constitution: "constitution", "evidence act": "evidence" };
  for (const [phrase, key] of Object.entries(want)) assert.deepEqual(resolveActs(phrase, cfg), [key], phrase);
  assert.deepEqual(parseQuick("302 IPC", cfg), { kind: "act-number", number: "302", acts: ["ipc"] }); assert.deepEqual(parseQuick("GST 16", cfg), { kind: "act-number", number: "16", acts: ["gst"] });
  assert.deepEqual(resolveActs("sanhita", cfg), ["bns", "bnss"]);   // an ambiguous word keeps both, popular first
  assert.deepEqual(resolveActs("banana", cfg), []); assert.deepEqual(resolveActs("ni", cfg).includes("it"), false);   // short words never match inside longer ones
  assert.deepEqual(titlePrefixes(["ni", "cpc"], cfg), ["the negotiable instruments act", "the code of civil procedure"]);
});
test("3. a number matches a judgment's case number or a full citation, never a report page number", () => {
  const page = { caseId: "a", citation: "[1996] 8 S.C.R. 138", caseNumber: undefined };
  const caseNo = { caseId: "b", citation: "[2014] 11 S.C.R. 921", caseNumber: "Criminal Appeal No. 138 of 2014" };
  assert.equal(numericOk("138", page), false); assert.equal(numericOk("138", caseNo), true);
  assert.equal(numericOk("138", { citation: "[2000] 1 S.C.R. 1380", caseNumber: "Civil Appeal No. 2138 of 1999" }), false);   // 138 inside a bigger number
  assert.equal(numericOk("State of UP", page), true);   // no number: untouched
  assert.equal(numericOk("Joshi 138", page), false); assert.equal(numericOk("Joshi 138", caseNo), true);
  assert.equal(isFullCitation("[2014] 11 S.C.R. 921"), true); assert.equal(isFullCitation("(2014) 8 SCC 138"), true); assert.equal(isFullCitation("2014 INSC 514"), true); assert.equal(isFullCitation("138"), false); assert.equal(isFullCitation("8 S.C.R."), false);
  assert.equal(numericOk("[1996] 8 S.C.R. 138", page), true); assert.equal(numericOk("(1996) 8 SCC 138", page), false);   // a full citation must match the same report series
  assert.equal(numericOk("2014 INSC 514", { caseId: "2014_INSC_514", citation: "[2014] 11 S.C.R. 921" }), true); assert.equal(numericOk("2014 INSC 515", { caseId: "2014_INSC_514" }), false);
});
test("4. Orders and Rules read the way the Code prints them", () => {
  assert.equal(unitReadable("O18R7"), "Order XVIII Rule 7"); assert.equal(unitReadable("O39"), "Order XXXIX"); assert.equal(unitReadable("O7R11"), "Order VII Rule 11"); assert.equal(unitReadable("O41R1"), "Order XLI Rule 1");
  assert.equal(unitReadable("O39R1"), "Order XXXIX Rule 1"); assert.equal(unitReadable("A21"), "Article 21"); assert.equal(unitReadable("138"), "Section 138"); assert.equal(unitReadable("143A"), "Section 143A"); assert.equal(unitReadable("S7"), "Seventh Schedule");
  assert.equal(toRoman(18), "XVIII"); assert.equal(toRoman(49), "XLIX"); assert.equal(toRoman(0), "0");
});
test("the config is consistent: unique keys, lower-case title starts, well-known keys all exist, names never empty", () => {
  const keys = cfg.acts.map((a) => a.key); assert.equal(new Set(keys).size, keys.length);
  for (const a of cfg.acts) { assert.equal(a.title, a.title.toLowerCase()); assert.ok(a.names.length > 0); }
  for (const [n, ks] of Object.entries(cfg.wellKnown)) { assert.match(n, /^\d{1,4}[A-Z]{0,2}$/); for (const k of ks) assert.ok(keys.includes(k), `${n}: ${k}`); }
  for (const must of ["138", "302", "21"]) assert.ok(cfg.wellKnown[must]);
});
