// Plain-words reasons for why a step of a review failed, and the early "is this a contract?" check. PURE (no styling, no network, never contains a key).
export const NOT_A_CONTRACT = "This doesn't look like a contract. Review works on agreements like NDAs, leases and service contracts.";

/** A model reply we got but could not use: "no_clauses" = it found no clauses in this text, "bad_reply" = the answer was not in the expected shape. */
export class StepError extends Error { constructor(code) { super(code); this.name = "StepError"; this.code = code; } }

const wait = (sec) => (sec >= 90 ? `about ${Math.ceil(sec / 60)} minutes` : `${Math.max(5, Math.ceil(sec))} seconds`);
/** The reason shown to the user. Every branch says what happened and what to do; nothing is vague. */
export function reasonFor(e) {
  if (e?.name === "StepError") return e.code === "no_clauses" ? "The AI found no clauses in this part. The text may not be a contract." : "The AI's answer could not be read. Try this part again.";
  if (e?.name === "AiError") {
    switch (e.kind) {
      case "rate_limit": return `The free AI limit is used up for now. Try again in ${typeof e.retryAfterSec === "number" ? wait(e.retryAfterSec) : "a few minutes (if it keeps happening, today's free quota is used up and it resets once a day)"}.`;
      case "unavailable": return "The AI service is not available right now. Try again in a minute.";
      case "timeout": return "The AI took too long to answer. Try again.";
      case "auth": return "The AI key on this server was rejected. This is a setup problem, not your document.";
      case "not_configured": return "The AI is not set up on this server.";
      case "blocked": return "The AI declined to read this part.";
      case "bad_request": return "The AI could not process this part (it rejected the request).";
    }
  }
  return "Something unexpected went wrong on the server. Try again; if it repeats, please tell us.";
}

/** True for a reason that may go away by itself (limit, outage, slow answer, unusable reply): the page retries these twice. Not for a rejected key, a blocked part or text with no clauses: retrying cannot help. */
export const isTransientReason = (reason) => /free AI limit is used up|not available right now|took too long|answer could not be read/i.test(String(reason ?? ""));

// Words that only agreements use (worth 2 each) and words common in them (worth 1 each); words that mark an invoice or receipt. Matched once each, on whole words.
const STRONG = [/\bagreement\b/i, /\bcontract\b/i, /\bdeed\b/i, /\bwhereas\b/i, /\bhereinafter\b/i, /\bin witness whereof\b/i, /\bthe parties\b/i, /\blicen[cs]e\b/i, /\blessor\b/i, /\blessee\b/i, /\blicensor\b/i, /\blicensee\b/i, /करार|अनुबंध|अनुबन्ध|समझौता|पट्टा/, /मकान मालिक|किराएदार|किरायेदार|लाइसेंस/];
const COMMON = [/\bshall\b/i, /\bhereby\b/i, /\bterminat/i, /\bgoverned by\b/i, /\bjurisdiction\b/i, /\bindemnif/i, /\bconfidential/i, /\bobligations?\b/i, /\bcovenants?\b/i, /\bnotwithstanding\b/i, /\bclause\b/i, /\bwarrant/i, /\bbreach\b/i, /\barbitrat/i, /\bterm of\b/i, /पक्ष|शर्त|नोटिस|सुरक्षा जमा|अवधि/];
const INVOICE = [/\binvoice\b/i, /\bbill to\b/i, /\bamount due\b/i, /\bsubtotal\b/i, /\bunit price\b/i, /\bqty\b/i, /\btotal due\b/i, /\bdate due\b/i, /\bdue date\b/i, /\btax invoice\b/i, /\breceipt\b/i, /\bvat\b/i, /\bgst\b/i, /\bpurchase order\b/i, /\bstatement of account\b/i];
const count = (list, t) => list.filter((r) => r.test(t)).length;
/** Does this text read like an agreement? { ok, score } — an invoice, receipt or note scores low, a contract high. Used before a review is started, so nothing is counted for a document that fails. */
export function looksLikeContract(text) {
  const t = String(text ?? ""), strong = count(STRONG, t), common = count(COMMON, t), inv = count(INVOICE, t), score = strong * 2 + common;
  return { ok: score >= 5 && score > inv * 2, score, invoiceHits: inv };
}
