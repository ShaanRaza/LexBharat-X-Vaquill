// Finds mentions of Act sections, Orders/Rules and Articles in the text of a judgment ("Section 302 IPC", "s. 138 of the Negotiable Instruments Act", "O. XXXIX, r. 1", "Article 137 of the
// Limitation Act") so the case page can link them to our Act pages. PURE logic: text in, mentions out; the database lookup is in statuteLinks.ts. Never guesses: a number with no Act named next to it
// is not a mention, and an Act name that could mean two different Acts (the 1940 and 1996 Arbitration Acts) is linked only when the year settles it.

const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100 };
export const romanToInt = (r) => [...String(r).toUpperCase()].reduce((t, c, i, a) => (ROMAN[c] < (ROMAN[a[i + 1]] ?? 0) ? t - ROMAN[c] : t + ROMAN[c]), 0);

/** Act names as judgments write them. `min`: judgments decided before this year mean an older Act of the same name, so a bare name is not linked (a year written next to the name is read instead). */
export const ACTS = [
  { key: "ipc", name: "Indian Penal Code, 1860", re: String.raw`Indian\s+Penal\s+Code(?:\s*\(\s*(?:Act\s+)?(?:XLV|45)\s+of\s+1860\s*\))?(?:,?\s*1860)?|Penal\s+Code,?\s*1860|I\.?\s?P\.?\s?C\b\.?` },
  { key: "crpc", name: "Code of Criminal Procedure, 1973", re: String.raw`Code\s+of\s+Criminal\s+Procedure(?:,?\s*(?:1898|1973))?|Cr\.?\s?P\.?\s?C\b\.?` },
  { key: "cpc", name: "Code of Civil Procedure, 1908", re: String.raw`Code\s+of\s+Civil\s+Procedure(?:,?\s*1908)?|C\.?\s?P\.?\s?C\b\.?` },
  { key: "ni", name: "Negotiable Instruments Act, 1881", re: String.raw`Negotiable\s+Instruments\s+Act(?:,?\s*1881)?|N\.?\s?I\.?\s+Act` },
  { key: "bns", name: "Bharatiya Nyaya Sanhita, 2023", re: String.raw`Bharatiya\s+Nyaya\s+Sanhita(?:,?\s*2023)?|BNS\b` },
  { key: "bnss", name: "Bharatiya Nagarik Suraksha Sanhita, 2023", re: String.raw`Bharatiya\s+Nagarik\s+Suraksha\s+Sanhita(?:,?\s*2023)?|BNSS\b` },
  { key: "bsa", name: "Bharatiya Sakshya Adhiniyam, 2023", re: String.raw`Bharatiya\s+Sakshya\s+Adhiniyam(?:,?\s*2023)?|BSA\b` },
  { key: "evidence", name: "Indian Evidence Act, 1872", re: String.raw`(?<!Books\s)(?<!Documents\s)(?:Indian\s+)?Evidence\s+Act(?:,?\s*1872)?` },
  { key: "contract", name: "Indian Contract Act, 1872", re: String.raw`(?:Indian\s+)?Contract\s+Act(?:,?\s*1872)?` },
  { key: "arbitration", name: "Arbitration and Conciliation Act, 1996", min: 1996, re: String.raw`Arbitration\s+and\s+Conciliation\s+Act(?:,?\s*(?:1996|1940))?|Arbitration\s+Act(?:,?\s*(?:1996|1940))?` },
  { key: "limitation", name: "Limitation Act, 1963", min: 1964, re: String.raw`Limitation\s+Act(?:,?\s*(?:1963|1908))?` },
  { key: "stamp", name: "Indian Stamp Act, 1899", re: String.raw`(?:Indian\s+)?Stamp\s+Act(?:,?\s*1899)?` },
  { key: "sra", name: "Specific Relief Act, 1963", min: 1964, re: String.raw`Specific\s+Relief\s+Act(?:,?\s*(?:1963|1877))?` },
  { key: "tpa", name: "Transfer of Property Act, 1882", re: String.raw`Transfer\s+of\s+Property\s+Act(?:,?\s*1882)?` },
  { key: "hma", name: "Hindu Marriage Act, 1955", re: String.raw`Hindu\s+Marriage\s+Act(?:,?\s*1955)?` },
  { key: "ndps", name: "Narcotic Drugs and Psychotropic Substances Act, 1985", re: String.raw`Narcotic\s+Drugs\s+and\s+Psychotropic\s+Substances\s+Act(?:,?\s*1985)?|N\.?D\.?P\.?S\.?\s+Act` },
  { key: "constitution", name: "Constitution of India", re: String.raw`Constitution(?:\s+of\s+India)?` },
];
const BY_KEY = Object.fromEntries(ACTS.map((a) => [a.key, a]));
const ACT_RE = ACTS.map((a) => `(?<${a.key}>${a.re})`).join("|");
const yearOf = (matched) => { const m = /\b(18\d\d|19\d\d|20\d\d)\b/.exec(matched.replace(/\([^)]*\)/g, "")); return m ? Number(m[1]) : null; };

/** Does this written Act name, in a judgment of `judgmentYear`, mean the Act we have? false when it is an older Act of the same name (or the year is unknown and the name is ambiguous). */
function isOurAct(act, written, judgmentYear) {
  const y = yearOf(written);
  if (act.key === "arbitration") return y === 1996 || (y === null && /conciliation/i.test(written)) || (y === null && judgmentYear !== null && judgmentYear >= 1996);
  if (act.key === "limitation") return y === 1963 || (y === null && judgmentYear !== null && judgmentYear >= 1964);
  if (act.key === "sra") return y === 1963 || (y === null && judgmentYear !== null && judgmentYear >= 1964);
  if (act.key === "crpc") return y !== 1898;
  return true;
}

const NUM = String.raw`\d{1,4}[A-Z]{0,2}(?:\s?\([a-zA-Z0-9]{1,4}\))*`;
const SEP = String.raw`(?:\s*(?:,|/|&|\band\b|\bor\b|\bread\s+with\b|\br/w\b)\s*)`;
const LIST = `${NUM}(?:${SEP}${NUM})*`;
const SEC = String.raw`(?:sections?|secs?\.?|ss\.|s\.|§)`;
const THE = String.raw`(?:the\s+)?`;
const FORMS = [
  new RegExp(String.raw`\b${SEC}\s*(?<list>${LIST})\s*,?\s*(?:of|under|in)\s+${THE}(?:${ACT_RE})`, "gi"),                         // Section 302 of the Indian Penal Code
  new RegExp(String.raw`\b${SEC}\s*(?<list>${LIST})\s*,\s*${THE}(?:${ACT_RE})`, "gi"),                                           // Section 302, Indian Penal Code
  new RegExp(String.raw`\b${SEC}\s*(?<list>${LIST})\s+${THE}(?:${ACT_RE})`, "gi"),                                              // s. 34 IPC ; section 138 BNS
  new RegExp(String.raw`(?:${ACT_RE})\s*(?:\([^)]{0,40}\))?\s*,?\s*[—–-]?\s*${SEC}\s*(?<list>${LIST})`, "gi"),                      // Indian Penal Code, s. 302 ; IPC ss. 302/34
];
const ORDER_RULE = new RegExp(String.raw`\b(?:Orders?|Or\.|O\.)\s*(?<order>[IVXLC]{1,6}|\d{1,3}[A-Z]?)\s*,?\s*(?:Rules?|rr?\.)\s*(?<rules>\d{1,3}[A-Z]?(?:\s*(?:,|and|&|to|-)\s*\d{1,3}[A-Z]?)*)(?:\s*,?\s*(?:of|under)?\s*${THE}(?<cpc>${BY_KEY.cpc.re}))?`, "gi");
const ORDER_ONLY = new RegExp(String.raw`\b(?:Orders?|Or\.|O\.)\s*(?<order>[IVXLC]{1,6}|\d{1,3}[A-Z]?)\s*,?\s*(?:of|under)?\s*${THE}(?<cpc>${BY_KEY.cpc.re})`, "gi");
const ARTICLE = new RegExp(String.raw`\b(?:Articles?|Arts?\.)\s*(?<list>${LIST})\s*,?\s*(?:of|under|in)\s+${THE}(?<act>Limitation\s+Act(?:,?\s*(?:1963|1908))?|(?:Indian\s+)?Stamp\s+Act(?:,?\s*1899)?|Constitution(?:\s+of\s+India)?)`, "gi");
const ARTICLE_AFTER = new RegExp(String.raw`\b(?<act>Constitution(?:\s+of\s+India)?)\s*(?:\([^)]{0,30}\))?\s*,\s*(?:Articles?|Arts?\.)\s*(?<list>${LIST})`, "gi");

const numbersIn = (list, offset, text) => {
  const out = []; const re = new RegExp(NUM, "gi");
  for (const m of list.matchAll(re)) {
    const base = /^\d{1,4}[A-Z]{0,2}/i.exec(m[0]);
    if (!base) continue;
    out.push({ number: base[0].toUpperCase(), start: offset + m.index, end: offset + m.index + base[0].length, shown: text.slice(offset + m.index, offset + m.index + base[0].length) });
  }
  return out;
};
const actFromGroups = (groups) => ACTS.find((a) => groups[a.key] !== undefined);

/** Mentions in `text`: [{ actKey, actName, kind: "section" | "order" | "rule" | "article", number (as stored: "138", "O39R1", "O37", "A137"), start, end, text }]. `judgmentYear`: used where the Act's name is ambiguous. */
export function findMentions(text, judgmentYear = null) {
  const out = [], taken = [];
  const add = (m) => { if (m.hidden) { out.push(m); return; } if (taken.some(([s, e]) => m.start < e && m.end > s)) return; out.push(m); taken.push([m.start, m.end]); };
  const t = String(text ?? "");
  const hasCpc = new RegExp(BY_KEY.cpc.re, "i").test(t);
  // Orders and Rules first (their "r. 1" / "O. XXXIX" must not be read as sections)
  for (const m of t.matchAll(ORDER_RULE)) {
    const g = m.groups, cpc = g.cpc !== undefined, order = /^\d/.test(g.order) ? g.order.toUpperCase() : String(romanToInt(g.order));
    if (!cpc && !hasCpc) continue;                         // "Order 39 Rule 1" with no CPC anywhere in the text: not sure which Code, so not linked
    const rulesAt = m.index + m[0].indexOf(g.rules, m[0].toLowerCase().search(/r/));
    const rules = [...g.rules.matchAll(/\d{1,3}[A-Z]?/gi)];
    const toNum = /\bto\b|-/i.test(g.rules) && rules.length === 2 && /^\d+$/.test(rules[0][0]) && /^\d+$/.test(rules[1][0]) && +rules[1][0] > +rules[0][0] && +rules[1][0] - +rules[0][0] <= 15;
    const list = toNum ? Array.from({ length: +rules[1][0] - +rules[0][0] + 1 }, (_, i) => ({ r: String(+rules[0][0] + i), at: i === 0 ? rules[0].index : rules[1].index })) : rules.map((r) => ({ r: r[0].toUpperCase(), at: r.index }));
    list.forEach((r, i) => add({ actKey: "cpc", actName: BY_KEY.cpc.name, kind: "rule", number: `O${order}R${r.r}`, hidden: toNum && i > 0 && i < list.length - 1, start: rulesAt + r.at, end: rulesAt + r.at + r.r.length, text: r.r, order }));   // the middle numbers of "rules 1 to 5" are in the Laws-referred-to list but have no place in the text to link
    add({ actKey: "cpc", actName: BY_KEY.cpc.name, kind: "order", number: `O${order}`, start: m.index, end: m.index + m[0].length, text: m[0], silent: true });
  }
  for (const m of t.matchAll(ORDER_ONLY)) {
    const order = /^\d/.test(m.groups.order) ? m.groups.order.toUpperCase() : String(romanToInt(m.groups.order));
    add({ actKey: "cpc", actName: BY_KEY.cpc.name, kind: "order", number: `O${order}`, start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  for (const re of [ARTICLE, ARTICLE_AFTER]) for (const m of t.matchAll(re)) {
    const written = m.groups.act, act = /constitution/i.test(written) ? BY_KEY.constitution : /stamp/i.test(written) ? BY_KEY.stamp : BY_KEY.limitation;
    if (act.key === "limitation" && !isOurAct(act, written, judgmentYear)) continue;
    const listAt = m.index + m[0].toLowerCase().indexOf(m.groups.list.toLowerCase());
    for (const n of numbersIn(m.groups.list, listAt, t)) add({ actKey: act.key, actName: act.name, kind: "article", number: act.key === "constitution" ? n.number : `A${n.number}`, start: n.start, end: n.end, text: n.shown });
  }
  for (const re of FORMS) for (const m of t.matchAll(re)) {
    const act = actFromGroups(m.groups); if (!act || act.key === "constitution") continue;
    if (!isOurAct(act, m.groups[act.key], judgmentYear)) continue;
    const listAt = m.index + m[0].toLowerCase().indexOf(m.groups.list.toLowerCase());
    for (const n of numbersIn(m.groups.list, listAt, t)) add({ actKey: act.key, actName: act.name, kind: "section", number: n.number, start: n.start, end: n.end, text: n.shown });
  }
  return out.filter((x) => !x.silent).sort((a, b) => a.start - b.start);
}

/** Splits `text` into pieces: { text } or { text, mention } for each mention (the number only), in order. */
export function segments(text, mentions) {
  const out = []; let at = 0;
  for (const m of mentions) { if (m.hidden || m.start < at) continue; if (m.start > at) out.push({ text: text.slice(at, m.start) }); out.push({ text: text.slice(m.start, m.end), mention: m }); at = m.end; }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

/** The words for a mention: "Section 302", "Order 39 Rule 1", "Article 137". */
export function mentionLabel(m) {
  if (m.kind === "section") return `Section ${m.number}`;
  if (m.kind === "article") return `Article ${m.number.replace(/^A/, "")}`;
  const mm = /^O(\d+[A-Z]*)(?:R(\d+[A-Z]*))?$/.exec(m.number);
  return mm ? (mm[2] ? `Order ${mm[1]} Rule ${mm[2]}` : `Order ${mm[1]}`) : m.number;
}
