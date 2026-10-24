// Section lookups hidden inside a question: "What does section 138 of the NI Act say about notice?" -> ["138 NI Act"], which the Acts search answers exactly (keyword lookup).
// PURE logic. Returns at most 3 lookups, as the "<number> <act>" strings parseSectionLookup understands.
const ACT = String.raw`((?:Code of (?:Civil|Criminal) Procedure(?:,?\s+(?:1[89]|20)\d\d)?)|(?:[A-Z][\w&'’.-]*(?:\s+(?:of|and|the|for|in|[A-Z][\w&'’.-]*))*?\s+(?:Act|Code|Sanhita|Adhiniyam)(?:,?\s+(?:1[89]|20)\d\d)?)|NI Act|IPC|CrPC|CPC|BNS|BNSS|BSA)`;
const SEC = String.raw`(?:[Ss]ections?|[Ss]ec\.|[Ss]\.)`;
const RE = new RegExp(String.raw`\b${SEC}\s+(\d{1,4}[A-Za-z]{0,2})\s*(?:\([a-z0-9]+\))*\s+(?:of|under|in)\s+(?:the\s+)?${ACT}`, "g");
const RE2 = new RegExp(String.raw`\b(?:the\s+)?${ACT}\s*,?\s+${SEC}\s+(\d{1,4}[A-Za-z]{0,2})`, "g");

// Orders, Rules and Articles of the Schedules: "Order 7 Rule 11", "O.39 R.1 CPC", "Order 37 of the CPC", "Article 137 of the Limitation Act".
const OR = /\b(?:Order|O\.?)\s*(\d{1,3}[A-Za-z]?)\s*,?\s*(?:Rules?|Rr?\.?)\s*(\d{1,3}[A-Za-z]?)(?:\s*(?:-|–|to|and)\s*(\d{1,3}))?/g;
const OO = /\b(?:Order|O\.?)\s*(\d{1,3}[A-Za-z]?)\s+(?:of\s+(?:the\s+)?)?(?:CPC|C\.P\.C\.?|Code of Civil Procedure(?:,?\s*1908)?)/g;
const ARTICLE = /\bArt(?:icle|\.)?\s*(\d{1,3}[A-Za-z]?)\s+(?:of\s+)?(?:the\s+)?(Limitation(?:\s+Act)?|(?:Indian\s+)?Stamp\s+Act)/gi;

export function extractLookups(question) {
  const out = [];
  const add = (num, act) => { const s = `${num.toUpperCase()} ${act.replace(/\s+/g, " ").trim()}`; if (!out.includes(s)) out.push(s); };
  for (const m of question.matchAll(RE)) add(m[1], m[2]);
  for (const m of question.matchAll(RE2)) add(m[2], m[1]);
  for (const m of question.matchAll(OR)) { const s = `Order ${m[1].toUpperCase()} Rule ${m[2].toUpperCase()}${m[3] ? `-${m[3]}` : ""}`; if (!out.includes(s)) out.push(s); }
  for (const m of question.matchAll(OO)) { const s = `Order ${m[1].toUpperCase()} CPC`; if (!out.includes(s)) out.push(s); }
  for (const m of question.matchAll(ARTICLE)) { const s = `Article ${m[1].toUpperCase()} ${/stamp/i.test(m[2]) ? "Indian Stamp Act" : "Limitation Act"}`; if (!out.includes(s)) out.push(s); }
  return out.slice(0, 3);
}
