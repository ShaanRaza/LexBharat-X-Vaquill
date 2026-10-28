// Feedback and usage rules. PURE logic: no database, no network, no styling. Used by the feedback API, the admin page and tests.
export const FEATURES = ["chat", "draft", "review"];
export const VOTES = ["up", "down"];
/** The quick picks shown after a thumbs-down. */
export const REASONS = ["Wrong law", "Missing law", "Wrong facts", "Too vague", "Other"];
export const MAX_COMMENT = 1000;

/** Checks a feedback request body. Returns { ok: true, value } or { ok: false, error }. The item id is checked against the user's own data by the server, not here. */
export function validateFeedback(body) {
  const b = body && typeof body === "object" ? body : {};
  if (!FEATURES.includes(b.feature)) return { ok: false, error: "Unknown feature." };
  if (!VOTES.includes(b.vote)) return { ok: false, error: "The vote must be up or down." };
  const itemId = String(b.itemId ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(itemId)) return { ok: false, error: "Bad item id." };
  const reasons = Array.isArray(b.reasons) ? [...new Set(b.reasons.map(String).filter((r) => REASONS.includes(r)))] : [];
  const comment = typeof b.comment === "string" ? b.comment.replace(/\s+/g, " ").trim().slice(0, MAX_COMMENT) : "";
  // reasons and a comment only make sense after a thumbs-down
  return { ok: true, value: { feature: b.feature, vote: b.vote, itemId, reasons: b.vote === "down" ? reasons : [], comment: b.vote === "down" ? comment : "" } };
}

/** A CSV cell: quoted when it holds a comma, quote or line break; a leading = + - @ is neutralised so a spreadsheet does not run it as a formula. */
export function csvCell(v) {
  let s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join("; ") : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(columns, rows) {
  return [columns.map((c) => csvCell(c.label)).join(","), ...rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(","))].join("\r\n") + "\r\n";
}

/** { up, down, total, upPct } for a feature's votes. */
export function ratio(up, down) {
  const total = up + down;
  return { up, down, total, upPct: total ? Math.round((100 * up) / total) : null };
}

/** Counter rows [{ day, metric, key, n, sum_ms }] -> one row per day with every metric as a number (and the average answer time). */
export function byDay(rows) {
  const days = new Map();
  for (const r of rows) {
    const d = days.get(r.day) ?? days.set(r.day, { day: r.day, visits: 0, chats: 0, drafts: 0, reviews: 0, uploads: 0, scans: 0, limits: 0, busy: 0, answers: 0, answerMs: 0, visitsByPage: {}, draftsByTemplate: {} }).get(r.day);
    const n = Number(r.n), ms = Number(r.sum_ms ?? 0);
    if (r.metric === "visit") { d.visits += n; d.visitsByPage[r.key] = (d.visitsByPage[r.key] ?? 0) + n; }
    else if (r.metric === "chat_asked") d.chats += n;
    else if (r.metric === "draft") { d.drafts += n; d.draftsByTemplate[r.key] = (d.draftsByTemplate[r.key] ?? 0) + n; }
    else if (r.metric === "review") d.reviews += n;
    else if (r.metric === "upload") d.uploads += n;
    else if (r.metric === "scan") d.scans += n;
    else if (r.metric === "limit_hit") d.limits += n;
    else if (r.metric === "model_busy") d.busy += n;
    else if (r.metric === "answer_time") { d.answers += n; d.answerMs += ms; }
  }
  return [...days.values()].sort((a, b) => (a.day < b.day ? 1 : -1)).map((d) => ({ ...d, avgAnswerSec: d.answers ? Math.round(d.answerMs / d.answers / 100) / 10 : null }));
}

export const MIN_MESSAGE = 3, MAX_MESSAGE = 2000, MAX_EMAIL = 200;
/** Checks the body of the in-app Feedback form: { message, email?, page? }. The page is kept as a path only (no query string). Returns { ok: true, value } or { ok: false, error }. */
export function validateMessage(body) {
  const b = body && typeof body === "object" ? body : {};
  const message = typeof b.message === "string" ? b.message.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim() : "";
  if (message.length < MIN_MESSAGE) return { ok: false, error: "Write a short message (at least 3 characters)." };
  if (message.length > MAX_MESSAGE) return { ok: false, error: `Please keep it under ${MAX_MESSAGE} characters.` };
  const email = typeof b.email === "string" ? b.email.trim() : "";
  if (email && (email.length > MAX_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { ok: false, error: "That email address does not look right. Leave it empty if you prefer." };
  const page = typeof b.page === "string" && /^\/[A-Za-z0-9/_.-]{0,150}$/.test(b.page.split("?")[0].split("#")[0]) ? b.page.split("?")[0].split("#")[0] : "";
  return { ok: true, value: { message, email, page } };
}
