// What the reader is told when an AI call fails (chat, drafting, query rewrite, review). PURE logic. ONE place names the real cause of a failed call in plain words,
// in the same three families as search by meaning: the limit was reached (HTTP 429), it is not set up or the key was refused, or it is busy (slow, down, unreachable).
// Routes call aiFailure(e, what) instead of writing "Busy, try again in a minute." themselves; src/lib/ai/ai.test.mjs fails if one does.

/** e = an AiError (kind: rate_limit | unavailable | timeout | auth | not_configured | blocked | bad_request) or anything else. `what`: { counted: "question" | "draft" | ... } is only used to say it was not counted. */
export function aiFailure(e, what = {}) {
  const kind = e && e.name === "AiError" ? e.kind : "";
  const tail = what.counted ? ` Your ${what.counted} was not counted.` : "";
  switch (kind) {
    case "rate_limit": return { family: "limit", code: "limit", busy: true, message: `The AI model has reached its request limit for now. Try again in a minute.${tail}` };
    case "unavailable": return { family: "busy", code: "busy", busy: true, message: `The AI model is busy. Try again in a minute.${tail}` };
    case "timeout": return { family: "busy", code: "busy", busy: true, message: `The AI model took too long to answer. Try again in a minute.${tail}` };
    case "auth": case "not_configured": return { family: "not_set_up", code: "not_set_up", busy: false, message: `The AI model is not set up on this site (its key is missing or was refused).${tail}` };
    case "blocked": return { family: "blocked", code: "blocked", busy: false, message: "The model declined to answer this question. Try rewording it." };
    default: return { family: "failed", code: "failed", busy: false, message: `Something went wrong.${tail} Please try again.` };
  }
}
/** A short clause for a step that was skipped ("Search help was skipped because ..."): the cause in words. */
export function aiReason(e) {
  const kind = e && e.name === "AiError" ? e.kind : "";
  return kind === "rate_limit" ? "the AI model has reached its request limit" : kind === "auth" || kind === "not_configured" ? "the AI model is not set up here" : kind === "timeout" ? "the AI model took too long" : kind === "unavailable" ? "the AI model is busy" : "the AI model could not be used";
}
