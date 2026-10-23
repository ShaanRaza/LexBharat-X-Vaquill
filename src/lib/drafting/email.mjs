// "Email me when it's ready" through Resend (free plan). OFF unless RESEND_API_KEY and RESEND_FROM (a sender on a verified domain) are both set. PURE of app state: env and fetch are arguments.
// The address is used once, in memory, to send the message; it is never written to the database or a log.
export const emailConfigured = (env) => !!env.RESEND_API_KEY?.trim() && !!env.RESEND_FROM?.trim();
export const validEmail = (s) => typeof s === "string" && s.length <= 200 && /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/.test(s.trim());
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function buildReadyEmail({ to, from, title, link }) {
  const text = `Your draft is ready: ${title}\n\nOpen it here: ${link}\n\nIt is a draft for review by a qualified lawyer, not legal advice. It is saved on the browser you used to create it.`;
  const html = `<p>Your draft is ready: <strong>${esc(title)}</strong></p><p><a href="${esc(link)}">Open the draft</a></p><p style="color:#555;font-size:13px">It is a draft for review by a qualified lawyer, not legal advice. It is saved on the browser you used to create it.</p>`;
  return { from, to: [to.trim()], subject: `Your draft is ready: ${title}`.slice(0, 200), html, text };
}

/** Sends the message. Returns { ok: true } or { ok: false, reason } (never throws; never includes the key or the address in the reason). */
export async function sendReadyEmail({ env, to, title, link, fetchImpl = fetch }) {
  if (!emailConfigured(env)) return { ok: false, reason: "not_configured" };
  if (!validEmail(to)) return { ok: false, reason: "bad_address" };
  try {
    const r = await fetchImpl("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`, "Content-Type": "application/json" }, body: JSON.stringify(buildReadyEmail({ to, from: env.RESEND_FROM.trim(), title, link })), signal: AbortSignal.timeout(10000) });
    return r.ok ? { ok: true } : { ok: false, reason: `resend_${r.status}` };
  } catch { return { ok: false, reason: "unreachable" }; }
}
