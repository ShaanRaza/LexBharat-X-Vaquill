// Reads one fill-in file of content/supplement/ (a short header, then the section text pasted by a person). PURE logic: text in, entry or errors out.
// A file whose text area is empty is "pending" (nothing to load yet). A file with text must have a valid header, or it is "error" and nothing from it is loaded.
export const DELIMITER = /^={3,}\s*SECTION TEXT\b.*$/i;
const KEYS = { "act": "act", "act id": "actId", "section": "section", "heading": "heading", "replaces existing text": "replaces", "source": "source", "source url": "sourceUrl", "date copied": "dateCopied" };
export const MIN_TEXT = 30, MAX_TEXT = 60000;

/** The key a section gets in act_sections_v, the same shape as the dataset's own keys ("s016", "s138", "s19A"). */
export const sectionKeyFor = (number) => `s${String(number).toUpperCase().padStart(3, "0")}`;

const validDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (!m) return false; const d = new Date(`${s}T00:00:00Z`); return d.getUTCFullYear() === +m[1] && d.getUTCMonth() + 1 === +m[2] && d.getUTCDate() === +m[3]; };

/** { status: "pending" | "ok" | "error", errors: string[], entry?: {...} } */
export function parseSupplementFile(raw, fileName = "", now = new Date()) {
  const lines = String(raw).replace(/\r\n?/g, "\n").split("\n"), head = {}, errors = [];
  let i = 0, found = false;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (DELIMITER.test(line.trim())) { found = true; i++; break; }
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const m = /^([^:]{1,40}):\s*(.*)$/.exec(line);
    if (!m) { errors.push(`Header line ${i + 1} is not "Name: value": ${line.slice(0, 40)}`); continue; }
    const k = KEYS[m[1].trim().toLowerCase()];
    if (!k) { errors.push(`Unknown header name "${m[1].trim()}" (line ${i + 1}).`); continue; }
    head[k] = m[2].trim();
  }
  if (!found) return { status: "error", errors: ['The line "=== SECTION TEXT (paste below this line) ===" is missing.'] };
  const body = lines.slice(i).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!body) return { status: "pending", errors: [] };
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(head.actId ?? "")) errors.push('"Act ID" is missing or not valid (keep the one that was filled in).');
  if (!/^\d{1,4}[A-Za-z]{0,3}$/.test(head.section ?? "")) errors.push('"Section" must be a number such as 28 or 11A.');
  if (head.sourceUrl === undefined || !/^https?:\/\/\S+$/i.test(head.sourceUrl)) errors.push('"Source URL" is missing: paste the web address you copied the text from.');
  if (!head.dateCopied || !validDate(head.dateCopied)) errors.push('"Date copied" must look like 2026-10-24.');
  else if (new Date(`${head.dateCopied}T00:00:00Z`) > new Date(now.getTime() + 86400000)) errors.push('"Date copied" is in the future.');
  const rep = (head.replaces ?? "no").toLowerCase();
  if (!["yes", "no", ""].includes(rep)) errors.push('"Replaces existing text" must be yes or no.');
  if ((head.heading ?? "").length > 200) errors.push('"Heading" is longer than 200 characters.');
  if (body.length < MIN_TEXT) errors.push(`The section text is very short (${body.length} characters).`);
  if (body.length > MAX_TEXT) errors.push(`The section text is too long (${body.length} characters; the most is ${MAX_TEXT}).`);
  if (/<\/?(?:p|div|span|br|table|a)\b/i.test(body)) errors.push("The text still contains web-page markup (<p>, <div> ...). Paste it as plain text.");
  if (errors.length) return { status: "error", errors };
  const number = head.section.toUpperCase();
  return { status: "ok", errors: [], entry: { fileName, actName: head.act ?? "", actId: head.actId, number, sectionKey: sectionKeyFor(number), heading: head.heading || null, replaces: rep === "yes",
    source: head.source || "India Code", sourceUrl: head.sourceUrl, copiedOn: head.dateCopied, body } };
}

/** FNV-1a style hash of what matters (header fields and text), to tell "changed" from "unchanged" without storing the file. */
export function entryHash(e) {
  let h = 2166136261; const s = JSON.stringify([e.actId, e.number, e.heading, e.replaces, e.source, e.sourceUrl, e.copiedOn, e.body]);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, "0");
}
