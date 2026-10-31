// A "section" whose text is only a table of contents: "375. Rape. 376. Punishment for rape. 376A. ...". Some source PDFs print an Act's list of sections and the loader filed that list under one
// section number. PURE logic. Used by the status shown for a section, and by the chat, which must never cite such a block as the law.
// Schedules also hold numbered lists that are real law text (institutions, goods, enactments), so a block counts as a contents list only when ALL of these hold:
//   shape      three or more "number. heading." entries that count up one by one and make up most of the text, the first entry carrying the section's own number, none naming an enactment or running long;
//   confirmed  the entries are the headings of that Act's own sections: the section after it really is titled like the second entry (headingOf(number) is the Act's own section list).
// Without the Act's headings to confirm against, a block is never called a contents list. A section whose TITLE is the list ("Rape. 376. Punishment ...") is flagged by the title alone.
import { looksLikeScanJunk } from "./scanJunk.mjs";
const ENTRY = /(?:^|\s)(\d{1,3}[A-Z]{0,2})\.\s+([A-Z][^.]{1,160}\.)/g;
const letters = (s) => String(s ?? "").toLowerCase().replace(/[^a-z]/g, "");

/** The "number. heading." entries of a text: [{ number, text }]. */
export const listEntries = (text) => [...String(text ?? "").trim().matchAll(ENTRY)].map((m) => ({ number: m[1], text: m[2], whole: m[0] }));

/** The shape test (see above). `number` is the section's own number. */
export function looksLikeContentsList(text, number) {
  const t = String(text ?? "").trim();
  if (t.length < 40 || number == null) return false;
  const m = listEntries(t);
  if (m.length < 3) return false;
  if (m.reduce((n, x) => n + x.whole.length, 0) / t.length <= 0.6) return false;
  const nums = m.map((x) => parseInt(x.number, 10));
  let good = 0;
  for (let i = 1; i < nums.length; i++) if (nums[i] - nums[i - 1] === 1 || nums[i] === nums[i - 1]) good++;
  if (good / (nums.length - 1) < 0.7) return false;
  if (m[0].number.toUpperCase() !== String(number).toUpperCase()) return false;
  return !m.some((x) => /\(\d+ of \d{4}\)|\bAct,? \d{4}/.test(x.text) || x.text.split(/\s+/).length > 22);
}

/** The entries after the first are the headings of the Act's own sections: by default at least two of them, and at least two in five, begin like the heading filed under that number (the chat's test: it must never drop real text).
 *  The status label uses the lighter { min: 1, share: 0.2 }: a wrong label is mild, a dropped source is not. */
export function confirmedByHeadings(text, headingOf, { min = 2, share = 0.4 } = {}) {
  if (typeof headingOf !== "function") return false;
  const rest = listEntries(text).slice(1);
  let same = 0;
  for (const e of rest) { const h = letters(headingOf(e.number)), a = letters(e.text); if (h.length >= 8 && a.length >= 8 && (h.startsWith(a.slice(0, 12)) || a.startsWith(h.slice(0, 12)))) same++; }
  return same >= min && same / Math.max(1, rest.length) >= share;
}

/** The heading is itself the list ("Rape. 376. Punishment for rape. 376A. ..."). Shape: two or more numbers counting up one by one after the first words (a title is often cut short, so the last entry may have no full stop).
 *  With the Act's own headings (`headingOf`) it must also be confirmed: a later entry is titled like that Act's section of the same number. Without them the shape alone decides (search results). */
export function headingIsContentsList(heading, headingOf) {
  const h = String(heading ?? ""), marks = [...h.matchAll(/(?:^|\s)(\d{1,3}[A-Z]{0,2})\.\s+(?=[A-Z])/g)];
  const nums = marks.map((x) => parseInt(x[1], 10));
  if (nums.length < 2) return false;
  for (let i = 1; i < nums.length; i++) if (nums[i] - nums[i - 1] !== 1 && nums[i] !== nums[i - 1]) return false;   // the numbers count up one by one: 376, 376A, 376AB ...
  if (/\(\d+ of \d{4}\)|\bAct,? \d{4}/.test(h)) return false;
  if (typeof headingOf !== "function") return true;
  const titles = marks.map((x, i) => ({ number: x[1], text: h.slice(x.index + x[0].length, marks[i + 1]?.index ?? h.length) }));
  return titles.some((e) => { const own = letters(headingOf(e.number)), a = letters(e.text); return own.length >= 8 && a.length >= 8 && (own.startsWith(a.slice(0, 12)) || a.startsWith(own.slice(0, 12))); });
}

/** A section is a contents list when its title is one, or its text has the shape and is confirmed against the Act's headings (the lighter test: this decides a label, never what the chat may cite). */
export const STATUS_CONFIRM = { min: 1, share: 0.2 };
export const isContentsList = ({ body, heading, number } = {}, headingOf) => headingIsContentsList(heading, headingOf) || (looksLikeContentsList(body, number) && confirmedByHeadings(body, headingOf, STATUS_CONFIRM));

/** The status to show: a contents list, or text that came out of the scan as broken words (scanJunk.mjs), is never "complete". Anything else keeps the status it has. Only the LABEL changes: nothing is hidden or removed. */
export const effectiveStatus = (status, section, headingOf) => (status === "complete" && (isContentsList(section, headingOf) || looksLikeScanJunk(section?.body)) ? "possibly_incomplete" : status);
