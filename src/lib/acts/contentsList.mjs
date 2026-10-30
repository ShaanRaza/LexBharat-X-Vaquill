// A "section" whose text is only a table of contents: "375. Rape. 376. Punishment for rape. 376A. ...". Some source PDFs print an Act's list of sections and the loader filed
// that list under one section number. PURE logic. Used by the status shown for a section, and by the chat, which must never cite such a block as the law.
const ENTRY = /(?:^|\s)(\d{1,3}[A-Z]{0,2})\.\s+[A-Z][^.]{1,160}\./g;

/** True when the text is mostly a run of "number. heading." entries whose numbers count up one by one. Short texts and ordinary prose are never lists. */
export function looksLikeContentsList(text) {
  const t = String(text ?? "").trim();
  if (t.length < 40) return false;
  const m = [...t.matchAll(ENTRY)];
  if (m.length < 3) return false;
  if (m.reduce((n, x) => n + x[0].length, 0) / t.length <= 0.6) return false;
  const nums = m.map((x) => parseInt(x[1], 10));
  let good = 0;
  for (let i = 1; i < nums.length; i++) if (nums[i] - nums[i - 1] === 1 || nums[i] === nums[i - 1]) good++;
  return good / (nums.length - 1) >= 0.7;
}

/** The heading is itself the list ("Rape. 376. Punishment for rape. 376A. ..."): two or more entries after the first words. */
export const headingIsContentsList = (heading) => { const h = String(heading ?? ""); return (h.match(/(?:^|\s)\d{1,3}[A-Z]{0,2}\.\s+[A-Z]/g) ?? []).length >= 2; };

/** A section is a contents list when its text is one, or its heading is. `body` may be left out (a list entry): the heading alone then decides. */
export const isContentsList = ({ body, heading } = {}) => headingIsContentsList(heading) || looksLikeContentsList(body);

/** The status to show: a contents list is never "complete". Anything else keeps the status it has. */
export const effectiveStatus = (status, section) => (status === "complete" && isContentsList(section) ? "possibly_incomplete" : status);
