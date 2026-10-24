// Contract-review rules that do NOT need a model. PURE logic. They decide which Indian-law sections to fetch for a contract (so the legal points can only rest on retrieved text) and which clauses a
// contract of this type usually has but this one lacks. The model does the judging; these checks make sure the obvious problems are never silently skipped.

export const CONTRACT_TYPES = {
  nda: { label: "NDA (confidentiality)", sides: ["Disclosing party", "Receiving party", "Both (mutual)"] },
  service: { label: "Service agreement", sides: ["Client", "Vendor / service provider"] },
  rent: { label: "Rent / leave and licence", sides: ["Landlord / licensor", "Tenant / licensee"] },
  employment: { label: "Employment", sides: ["Employer", "Employee"] },
  other: { label: "Other", sides: ["First party", "Second party"] },
};
export const isContractType = (t) => Object.prototype.hasOwnProperty.call(CONTRACT_TYPES, t);
export const sideOk = (type, side) => isContractType(type) && CONTRACT_TYPES[type].sides.includes(side);

const FOREIGN = "England|Wales|English|New York|Delaware|California|Texas|Singapore|United States|U\\.?S\\.?A?\\b|United Kingdom|U\\.?K\\.?\\b|Dubai|UAE|Hong Kong|Australia|Canada|Germany|France|Switzerland|Netherlands|Ireland";
/** Topics found in the contract text. Each: { id, label, lookups: ["27 Indian Contract Act", ...] (exact sections to fetch), queries: [...] (search phrases) }. */
export const TOPICS = [
  { id: "non_compete", label: "Non-compete / restraint of trade", re: /non-?compet|restraint of trade|shall not[^.]{0,120}(?:compete|carry on|be engaged|be interested|solicit)|competing business/i, lookups: ["27 Indian Contract Act"], queries: ["agreement in restraint of trade void"] },
  { id: "penalty", label: "Penalty / liquidated damages", re: /penalt|liquidated damages|agreed damages|forfeit/i, lookups: ["74 Indian Contract Act"], queries: ["compensation for breach of contract where penalty stipulated"] },
  { id: "unlimited_liability", label: "Unlimited liability / indemnity", re: /unlimited|without (?:any )?(?:limit|cap)|no (?:cap|limit) on|indirect and consequential|consequential (?:loss|damage)|indemnif/i, lookups: ["73 Indian Contract Act"], queries: ["compensation for loss or damage caused by breach of contract"] },
  { id: "foreign_law", label: "Foreign governing law or courts", re: new RegExp(`(?:laws?|courts?|jurisdiction)[^.]{0,60}\\b(?:${FOREIGN})`, "i"), lookups: ["28 Indian Contract Act"], queries: ["agreement in restraint of legal proceedings"] },
  { id: "arbitration", label: "Arbitration", re: /arbitrat/i, lookups: ["7 Arbitration and Conciliation Act"], queries: [] },
  { id: "unlawful_object", label: "Unlawful object or consideration", re: /bribe|illegal|unlawful object|without consideration/i, lookups: ["23 Indian Contract Act"], queries: [] },
];
const RENT_LAW = ["17 Registration Act", "107 Transfer of Property Act"];
const STATE_LAW = { maharashtra: ["55 Maharashtra Rent Control Act", "36A Maharashtra Stamp Act"], karnataka: ["4 Karnataka Rent Act", "16 Karnataka Rent Act"] };
export const detectState = (text) => (/maharashtra|mumbai|pune|thane|nagpur/i.test(text) ? "maharashtra" : /karnataka|bengaluru|bangalore|mysuru/i.test(text) ? "karnataka" : null);

/** Which topics apply, and the exact lookups and queries to fetch the law for them (de-duplicated). */
export function lawPlan(text, type, topicIds = []) {
  const topics = TOPICS.filter((t) => t.re.test(text) || topicIds.includes(t.id));
  const lookups = new Set(topics.flatMap((t) => t.lookups)), queries = new Set(topics.flatMap((t) => t.queries));
  const state = detectState(text);
  if (type === "rent") { RENT_LAW.forEach((l) => lookups.add(l)); (STATE_LAW[state] ?? []).forEach((l) => lookups.add(l)); queries.add(`${state ? state + " " : ""}stamp duty on leave and licence agreement`); queries.add("registration of lease compulsory"); }
  if (type === "nda" || type === "service" || type === "employment") { lookups.add("27 Indian Contract Act"); lookups.add("74 Indian Contract Act"); }
  return { topics, lookups: [...lookups], queries: [...queries].slice(0, 4), state };
}

// ---- clauses a contract of this type usually has, checked by presence of words
const EXPECT = {
  nda: [
    ["Exclusions from confidential information", /public domain|publicly available|already (?:known|in the possession)|independently developed|rightfully received/i, "Without carve-outs for public or independently developed information, almost anything can be called confidential."],
    ["Disclosure required by law or a court", /required by law|court order|legal process|regulat\w+ (?:authority|requirement)/i, "A party should be allowed to disclose when a court, regulator or law requires it."],
    ["Return or destruction of materials", /return or destr|return all|destroy/i, "The agreement should say what happens to the information when the relationship ends."],
    ["How long confidentiality lasts", /surviv|(?:for|period of)[^.]{0,30}\d+\)?\s*years? (?:after|from)/i, "The length of the confidentiality duty is unclear."],
    ["Dispute resolution", /arbitrat|mediat|jurisdiction|courts? (?:at|of|in)/i, "No way of settling disputes is stated."],
    ["Remedies (injunction or damages)", /injunct|specific performance|equitable relief|damages/i, "The agreement does not say what the injured party can ask for."],
  ],
  service: [
    ["Payment terms", /invoice|payment|fees?\b/i, "Fees and payment timing are not set out."],
    ["Limit on liability (a cap)", /(?:cap|limit)\w* (?:on |of )?(?:the )?(?:aggregate |total )?liab|liab\w+[^.]{0,80}(?:shall not exceed|is limited to|capped|limited to)/i, "There is no cap on how much either party can owe the other."],
    ["Termination", /terminat|notice|end(?:ed|s)? (?:this|the) agreement|expir/i, "How and when the agreement can be ended is not stated."],
    ["Intellectual property ownership", /intellectual property|work product|ownership of|copyright/i, "Who owns what is created under the agreement is not stated."],
    ["Confidentiality", /confidential/i, "There is no confidentiality duty."],
    ["Dispute resolution", /arbitrat|mediat|dispute|jurisdiction/i, "No way of settling disputes is stated."],
    ["Data protection / personal data", /personal data|data protection|privacy/i, "Handling of personal data is not addressed (relevant if the service touches customer data)."],
    ["Force majeure", /force majeure|act of god|beyond (?:the )?reasonable control/i, "Nothing deals with events outside either party's control."],
  ],
  rent: [
    ["Registration of the agreement", /regist(?:er|ration|ered)/i, "The agreement says nothing about registration. Whether and how a rent or leave and licence agreement must be registered depends on the term and the state."],
    ["Stamp duty", /stamp/i, "The agreement says nothing about stamp duty or who bears it. Unstamped or under-stamped agreements can be refused as evidence."],
    ["Police verification / intimation", /police|verification/i, "Many cities require the owner to inform the police about a new occupant; the agreement does not mention it."],
    ["Maintenance, repairs and utility bills", /maintenance|repairs?|electricity|utilit/i, "Who pays for what during the term is not clear."],
    ["Escalation or renewal terms", /renew|escalat|increase/i, "Nothing says how rent changes or how the term can be renewed."],
    ["Inventory / condition of the premises", /inventory|condition of the premises|handover|fixtures/i, "There is no record of the condition or contents at handover."],
  ],
  employment: [
    ["Probation and confirmation", /probation/i, "No probation period or confirmation process is described."],
    ["Notice period", /notice/i, "No notice period for leaving is stated."],
    ["Confidentiality", /confidential/i, "There is no confidentiality duty."],
    ["Ownership of work created", /intellectual property|inventions?|work product|copyright/i, "Who owns the employee's work is not stated."],
    ["Leave and benefits", /leave|holiday|benefits?|provident|gratuity/i, "Leave and benefits are not described."],
    ["Dispute resolution", /arbitrat|dispute|jurisdiction/i, "No way of settling disputes is stated."],
  ],
  other: [
    ["Governing law and courts", /governing law|governed by|jurisdiction/i, "The law and courts that apply are not stated."],
    ["How the agreement can be ended", /terminat|notice|end(?:ed|s)? (?:this|the) agreement|expir/i, "How and when the agreement can be ended is not stated."],
    ["Dispute resolution", /arbitrat|mediat|dispute/i, "No way of settling disputes is stated."],
  ],
};
/** Usual clauses with no trace in the text: [{ clause, why, source: "check" }]. */
export const missingClauses = (type, text) => (EXPECT[type] ?? EXPECT.other).filter(([, re]) => !re.test(text)).map(([clause, , why]) => ({ clause, why, source: "check" }));

// ---- cutting a long contract into parts
const BOUNDARY = /^\s*(?:clause\s+|article\s+|section\s+)?\d{1,2}[.)]\s+\S/im;
/** Splits contract text into parts of about `maxChars`, only between top-level clauses where possible. Returns [{ i, text, start, end }] (offsets into the text). */
export function splitParts(text, maxChars = 8000) {
  const cuts = [0]; const re = /\n\s*(?:clause\s+|article\s+|section\s+)?\d{1,2}[.)]\s+[A-Z]/gi;
  for (const m of text.matchAll(re)) cuts.push(m.index + 1);
  cuts.push(text.length);
  const parts = []; let start = 0, last = 0;
  for (let k = 1; k < cuts.length; k++) {
    const next = cuts[k];
    if (next - start > maxChars && last > start) { parts.push({ start, end: last }); start = last; }
    if (next - start > maxChars && k < cuts.length - 1) { /* one clause longer than a part: cut inside it below */ }
    last = next;
  }
  if (start < text.length) parts.push({ start, end: text.length });
  const out = [];
  for (const p of parts) {
    for (let s = p.start; s < p.end; ) {
      let e = Math.min(p.end, s + maxChars);
      if (e < p.end) { const cut = Math.max(text.lastIndexOf("\n", e), text.lastIndexOf(". ", e) + 1); if (cut > s + maxChars * 0.5) e = cut; }
      out.push({ start: s, end: e }); s = e;
    }
  }
  return out.map((p, i) => ({ i, start: p.start, end: p.end, text: text.slice(p.start, p.end).trim() })).filter((p) => p.text);
}

// ---- checking what the model said against the text
const norm = (s) => String(s).toLowerCase().replace(/[“”"'‘’]/g, "").replace(/\s+/g, " ").trim();
/** Is the quote really in the text (ignoring case, quotes and spacing)? A quote that is not there is dropped rather than shown. */
export function quoteInText(quote, text) {
  const q = norm(quote), t = norm(text); if (q.length < 12) return false;
  if (t.includes(q)) return true;
  const words = q.split(" "); return words.length > 8 && t.includes(words.slice(0, 8).join(" "));
}
