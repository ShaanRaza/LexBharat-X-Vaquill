// Where the three actions on a Ready Vault document lead, and how the receiving pages read the document id back. PURE (no styling, no network).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const chatLink = (id) => `/ask?doc=${id}`;
export const reviewLink = (id) => `/work/reviews?doc=${id}`;
export const previewLink = (id) => `/work/vault/${id}`;
/** The document id in a "?doc=<id>" query string, or null if it is missing or not a document id. */
export const docFromSearch = (search) => { const v = new URLSearchParams(String(search ?? "")).get("doc"); return v && UUID.test(v) ? v : null; };
/** Ids that were still being prepared in `before` and are Ready in `after` (used to show "Ready. Ask a question..." once). */
export const newlyReady = (before, after) => {
  const was = new Map(before.map((d) => [d.id, d.status]));
  return after.filter((d) => d.status === "ready" && (was.get(d.id) === "processing" || was.get(d.id) === "waiting"));
};
