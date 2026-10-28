import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { NOT_A_CONTRACT, StepError, isTransientReason, looksLikeContract, reasonFor } from "./reasons.mjs";

const invoice = "GK9FFL3M0007 · $23.60 USD due October 28, 2026 Page 1 of 1\nInvoice\nInvoice number GK9FFL3M0007\nDate of issue October 28, 2026\nDate due October 28, 2026\nVAT Registration India GST\nBill to\nAmount due $23.60\nSubtotal $20.00 Total $23.60\nThank you for your business.";
const nda = "NON-DISCLOSURE AGREEMENT. This Agreement is made between the Disclosing Party and the Receiving Party (the parties). The Receiving Party shall keep the Confidential Information confidential and shall not disclose it. This Agreement shall be governed by the laws of India and the courts at Mumbai shall have jurisdiction. Either party may terminate on notice.";
test("an invoice is not a contract; an NDA is; short or empty text is not", () => {
  assert.equal(looksLikeContract(invoice).ok, false); assert.equal(looksLikeContract(nda).ok, true);
  assert.equal(looksLikeContract("").ok, false); assert.equal(looksLikeContract("Notes: call Rahul on Monday.").ok, false);
  assert.match(NOT_A_CONTRACT, /^This doesn't look like a contract\. Review works on agreements like NDAs, leases and service contracts\.$/);
});
test("a Hindi rent agreement counts as a contract", () => {
  const t = fs.readFileSync(new URL("../../../../lexbharat-data/w8-test-files/scan-hindi-original.txt", import.meta.url), "utf8");
  assert.equal(looksLikeContract(t).ok, true);
});
const ai = (kind, extra = {}) => Object.assign(new Error("x"), { name: "AiError", kind, ...extra });
test("every failure gets a specific reason in plain words", () => {
  assert.match(reasonFor(ai("rate_limit", { retryAfterSec: 42 })), /free AI limit is used up for now\. Try again in 42 seconds/);
  assert.match(reasonFor(ai("rate_limit", { retryAfterSec: 600 })), /about 10 minutes/);
  assert.match(reasonFor(ai("rate_limit")), /resets once a day/);
  assert.match(reasonFor(ai("unavailable")), /not available right now/); assert.match(reasonFor(ai("timeout")), /took too long/);
  assert.match(reasonFor(ai("auth")), /key on this server was rejected/); assert.match(reasonFor(ai("not_configured")), /not set up/);
  assert.match(reasonFor(ai("blocked")), /declined/); assert.match(reasonFor(ai("bad_request")), /rejected the request/);
  assert.match(reasonFor(new StepError("no_clauses")), /no clauses.*may not be a contract/); assert.match(reasonFor(new StepError("bad_reply")), /could not be read/);
  assert.match(reasonFor(new Error("boom")), /unexpected/);
  for (const e of [ai("rate_limit"), ai("auth"), new StepError("bad_reply"), new Error("x")]) assert.doesNotMatch(reasonFor(e), /could not be reviewed\.$/);
});
test("only reasons that can pass by themselves are retried automatically", () => {
  for (const e of [ai("rate_limit"), ai("unavailable"), ai("timeout"), new StepError("bad_reply")]) assert.equal(isTransientReason(reasonFor(e)), true);
  for (const e of [ai("auth"), ai("not_configured"), ai("blocked"), ai("bad_request"), new StepError("no_clauses"), new Error("x")]) assert.equal(isTransientReason(reasonFor(e)), false);
});
