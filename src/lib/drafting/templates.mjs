// Drafting templates: field handling, placeholders, amounts and dates, validation, state-specific reliance and reminders. PURE logic: no database, no network, no styling.
// The templates themselves are plain JSON files in content/templates/ (one per template); scripts/drafting/build-templates.mjs checks them and bundles them. Replacing a file needs no code change.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const below100 = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : ""));
const below1000 = (n) => (n >= 100 ? ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + below100(n % 100) : "") : below100(n));

/** Whole rupees in words using the Indian system (Crore, Lakh, Thousand): 250000 -> "Two Lakh Fifty Thousand". Returns "Zero" for 0. Supports up to 999 crore crore is not needed; throws above 99,99,99,99,999. */
export function rupeesInWords(n) {
  if (!Number.isInteger(n) || n < 0 || n > 99_99_99_99_999) throw new RangeError("amount out of range");
  if (n === 0) return "Zero";
  const parts = [];
  const crore = Math.floor(n / 1_00_00_000); n %= 1_00_00_000;
  const lakh = Math.floor(n / 1_00_000); n %= 1_00_000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(below1000(crore) + " Crore");
  if (lakh) parts.push(below100(lakh) + " Lakh");
  if (thousand) parts.push(below100(thousand) + " Thousand");
  if (n) parts.push(below1000(n));
  return parts.join(" ");
}

/** "2,50,000" style grouping. */
export const indianGrouping = (n) => { const s = String(n); if (s.length <= 3) return s; const last3 = s.slice(-3), rest = s.slice(0, -3); return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3; };

/** Parses what a person types as an amount ("2,50,000", "Rs. 250000", "₹2.5 lakh" is NOT accepted): digits with optional commas and optional paise. Returns { rupees, paise } or null. */
export function parseAmount(raw) {
  const m = /^\s*(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(\d{1,2}))?\s*(?:\/-)?\s*$/i.exec(String(raw ?? ""));
  if (!m) return null;
  const rupees = Number(m[1].replace(/,/g, ""));
  if (!Number.isSafeInteger(rupees) || rupees > 99_99_99_99_999) return null;
  return { rupees, paise: m[2] ? Number(m[2].padEnd(2, "0")) : 0 };
}
/** "₹2,50,000/- (Rupees Two Lakh Fifty Thousand only)"; with paise: "₹10.50 (Rupees Ten and Fifty Paise only)". */
export function formatAmount(raw) {
  const a = parseAmount(raw); if (!a) return null;
  const fig = `₹${indianGrouping(a.rupees)}${a.paise ? "." + String(a.paise).padStart(2, "0") : "/-"}`;
  const words = a.paise ? `Rupees ${rupeesInWords(a.rupees)} and ${below100(a.paise)} Paise only` : `Rupees ${rupeesInWords(a.rupees)} only`;
  return `${fig} (${words})`;
}

/** "2026-03-15" -> "15 March 2026"; null for anything that is not a real calendar date. */
export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "")); if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3], t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d && y >= 1900 && y <= 2100 ? `${d} ${MONTHS[mo - 1]} ${y}` : null;
}

/** The token shown where information is missing: "[DRAWER'S NAME]". Taken from the field label without its bracketed explanation. */
export function placeholderFor(label) {
  let t = String(label).replace(/\s*\([^)]*\)/g, "").replace(/[^A-Za-z0-9' /&-]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
  if (t.length > 40) t = t.slice(0, 40).replace(/\s+\S*$/, "");
  t = t.replace(/(?:\s+(?:IN|OF|TO|FOR|THE|AND|OR|A|AN|ON|AT|BY|WHO|THAT|IF|IS))+$/, "");   // never end on a dangling word
  return `[${t}]`;
}

/** End date of a period that starts on `iso` and lasts `months` months: the day before the same day `months` later ("2026-04-01" + 11 -> "28 February 2027"). Null if the inputs are not usable. Computed here so the model never does date arithmetic. */
export function periodEnd(iso, months) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "")), n = Number(months);
  if (!m || !formatDate(iso) || !Number.isInteger(n) || n < 1 || n > 600) return null;
  const y = +m[1], mo = +m[2] - 1, d = +m[3], lastDay = new Date(Date.UTC(y, mo + n + 1, 0)).getUTCDate();
  const end = new Date(Date.UTC(y, mo + n, Math.min(d, lastDay)) - 24 * 3600 * 1000);
  return formatDate(`${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`);
}
/** Facts worked out from the answers (never by the model): [{ label, display }]. */
export function derivedFacts(template, values) {
  const out = [];
  if (template.fields.some((f) => f.key === "start_date") && template.fields.some((f) => f.key === "term_months")) { const e = periodEnd(values.start_date, values.term_months); if (e) out.push({ label: "End date (worked out from the start date and the period)", display: e }); }
  return out;
}

/** The document title for these answers (the rent agreement's title follows the arrangement chosen). */
export function docTitleFor(template, values) {
  const by = template.docTitleBy;
  return (by && by.map[String(values[by.field] ?? "")]) || template.docTitle;
}

/** Is the field shown for these answers? ("when": { "field": "x", "equals": "y" }) */
export const fieldVisible = (f, values) => !f.when || String(values[f.when.field] ?? "") === f.when.equals;

/** A value as shown in the draft, or null when empty or invalid. */
export function formatValue(field, raw) {
  const v = String(raw ?? "").trim(); if (!v) return null;
  if (field.type === "date") return formatDate(v);
  if (field.type === "amount") return formatAmount(v);
  if (field.type === "number") return Number.isFinite(Number(v)) && Number(v) >= 0 ? String(Number(v)) : null;
  return v;
}

/** Every visible field with its answer: [{ key, label, group, required, value (raw), display (or null), placeholder, missing }]. */
export function resolveFields(template, values) {
  return template.fields.filter((f) => fieldVisible(f, values)).map((f) => {
    const display = formatValue(f, values[f.key]);
    return { key: f.key, label: f.label, group: f.group ?? null, required: !!f.required, type: f.type, value: String(values[f.key] ?? "").trim(), display, placeholder: f.placeholder ? `[${String(f.placeholder).toUpperCase()}]` : placeholderFor(f.label), missing: display === null,
      ifMissing: f.ifMissing ?? (f.required ? "placeholder" : "omit") };
  });
}

/** Checks the form answers. Returns { errors: { key: message } }. Empty optional fields are fine (they become placeholders). */
export function validateInput(template, values) {
  const errors = {};
  for (const f of template.fields) {
    if (!fieldVisible(f, values)) continue;
    const v = String(values[f.key] ?? "").trim();
    if (!v) { if (f.required) errors[f.key] = "Required."; continue; }
    if (v.length > 3000) errors[f.key] = "Too long (3,000 characters at most).";
    else if (f.type === "date" && !formatDate(v)) errors[f.key] = "Enter a real date.";
    else if (f.type === "amount" && !parseAmount(v)) errors[f.key] = "Enter the amount in digits, for example 250000.";
    else if (f.type === "number" && !(Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) < 100000)) errors[f.key] = "Enter a whole number.";
    else if ((f.type === "select" || f.type === "state") && !f.options.includes(v)) errors[f.key] = "Choose one of the options.";
  }
  return { errors };
}

/** Replaces {{key}} (answer or placeholder) and {{a|b}} (first answer that is not empty, else the last one's placeholder) in text a template wrote. */
export function fillTokens(text, resolved) {
  const by = new Map(resolved.map((r) => [r.key, r]));
  return String(text).replace(/\{\{\s*([a-z0-9_]+(?:\s*\|\s*[a-z0-9_]+)*)\s*\}\}/g, (_, spec) => {
    const keys = spec.split("|").map((k) => k.trim());
    for (const k of keys) { const r = by.get(k); if (r && r.display) return r.display; }
    const last = by.get(keys[keys.length - 1]);
    return last ? last.placeholder : `[${keys[keys.length - 1].replace(/_/g, " ").toUpperCase()}]`;
  });
}

/** Exact lookups ("138 NI Act") the template relies on for these answers: its own, the chosen state's, and conditional ones. [{ lookup, why }] */
export function relianceFor(template, values) {
  const out = [...(template.relies_on ?? [])];
  const st = template.state_relies_on?.[String(values.state ?? "")]; if (st) out.push(...st);
  for (const c of template.conditional_relies_on ?? []) if (String(values[c.when.field] ?? "") === c.when.equals) out.push({ lookup: c.lookup, why: c.why });
  return out;
}

/** The "check" reminders for these answers (state-limited ones only for their states), with {{tokens}} filled. [{ id, text }] */
export function remindersFor(template, values) {
  const resolved = resolveFields(template, values);
  return (template.reminders ?? []).filter((r) => !r.states || r.states.includes(String(values.state ?? ""))).map((r) => ({ id: r.id, text: fillTokens(r.text, resolved) }));
}

const FIELD_TYPES = ["text", "textarea", "date", "amount", "number", "select", "state"];
/** Problems found in a template file (an empty list means it is valid). */
export function validateTemplate(t) {
  const p = [];
  if (!["notice", "agreement"].includes(t.style)) p.push('style must be "notice" or "agreement"');
  for (const k of ["id", "title", "description", "docTitle"]) if (typeof t[k] !== "string" || !t[k].trim()) p.push(`missing ${k}`);
  if (!/^[a-z0-9-]+$/.test(t.id ?? "")) p.push("id must be lowercase letters, digits and hyphens");
  const keys = new Set();
  if (!Array.isArray(t.fields) || !t.fields.length) p.push("no fields");
  for (const f of t.fields ?? []) {
    if (!/^[a-z0-9_]+$/.test(f.key ?? "")) p.push(`bad field key ${f.key}`);
    if (keys.has(f.key)) p.push(`duplicate field ${f.key}`); keys.add(f.key);
    if (!FIELD_TYPES.includes(f.type)) p.push(`field ${f.key}: unknown type ${f.type}`);
    if ((f.type === "select" || f.type === "state") && !(Array.isArray(f.options) && f.options.length)) p.push(`field ${f.key}: needs options`);
    if (!f.label) p.push(`field ${f.key}: no label`);
    if (f.ifMissing && !["placeholder", "omit"].includes(f.ifMissing)) p.push(`field ${f.key}: ifMissing must be placeholder or omit`);
    if (f.when && !t.fields.some((g) => g.key === f.when.field)) p.push(`field ${f.key}: "when" points to unknown field`);
  }
  const ids = new Set();
  if (!Array.isArray(t.sections) || !t.sections.length) p.push("no sections");
  for (const s of t.sections ?? []) {
    if (!/^[a-z0-9-]+$/.test(s.id ?? "")) p.push(`bad section id ${s.id}`);
    if (ids.has(s.id)) p.push(`duplicate section ${s.id}`); ids.add(s.id);
    if (!s.title) p.push(`section ${s.id}: no title`);
    if (!s.fixed && !s.instruction) p.push(`section ${s.id}: needs an instruction or fixed text`);
    for (const m of String(s.fixed ?? "").matchAll(/\{\{\s*([a-z0-9_|\s]+)\s*\}\}/g)) for (const k of m[1].split("|").map((x) => x.trim())) if (!keys.has(k)) p.push(`section ${s.id}: token {{${k}}} is not a field`);
  }
  for (const r of t.reminders ?? []) for (const m of String(r.text).matchAll(/\{\{\s*([a-z0-9_|\s]+)\s*\}\}/g)) for (const k of m[1].split("|").map((x) => x.trim())) if (!keys.has(k)) p.push(`reminder ${r.id}: token {{${k}}} is not a field`);
  const lookups = [...(t.relies_on ?? []), ...Object.values(t.state_relies_on ?? {}).flat(), ...(t.conditional_relies_on ?? [])];
  for (const l of lookups) if (!/^\d+[A-Za-z]{0,2}\s+\S/.test(l.lookup ?? "")) p.push(`bad lookup "${l.lookup}" (use "138 NI Act")`);
  if (t.state_relies_on && ![...t.fields].some((f) => f.key === "state")) p.push("state_relies_on needs a field with key state");
  return p;
}
