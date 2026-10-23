// Section lookups hidden inside a question: "What does section 138 of the NI Act say about notice?" -> ["138 NI Act"], which the Acts search answers exactly (keyword lookup).
// PURE logic. Returns at most 3 lookups, as the "<number> <act>" strings parseSectionLookup understands.
const ACT = String.raw`((?:Code of (?:Civil|Criminal) Procedure(?:,?\s+(?:1[89]|20)\d\d)?)|(?:[A-Z][\w&'’.-]*(?:\s+(?:of|and|the|for|in|[A-Z][\w&'’.-]*))*?\s+(?:Act|Code|Sanhita|Adhiniyam)(?:,?\s+(?:1[89]|20)\d\d)?)|NI Act|IPC|CrPC|CPC|BNS|BNSS|BSA)`;
const SEC = String.raw`(?:[Ss]ections?|[Ss]ec\.|[Ss]\.)`;
const RE = new RegExp(String.raw`\b${SEC}\s+(\d{1,4}[A-Za-z]{0,2})\s*(?:\([a-z0-9]+\))*\s+(?:of|under|in)\s+(?:the\s+)?${ACT}`, "g");
const RE2 = new RegExp(String.raw`\b(?:the\s+)?${ACT}\s*,?\s+${SEC}\s+(\d{1,4}[A-Za-z]{0,2})`, "g");

export function extractLookups(question) {
  const out = [];
  const add = (num, act) => { const s = `${num.toUpperCase()} ${act.replace(/\s+/g, " ").trim()}`; if (!out.includes(s)) out.push(s); };
  for (const m of question.matchAll(RE)) add(m[1], m[2]);
  for (const m of question.matchAll(RE2)) add(m[2], m[1]);
  return out.slice(0, 3);
}
