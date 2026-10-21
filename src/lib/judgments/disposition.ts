// One display vocabulary for dispositions. The Supreme Court source spells the same outcome several ways ("Appeal(s) allowed", "Case Allowed",
// "Disposed off"); High Court chips use the same words (see the CASE in scripts/judgments/export-judgments-hc.sql). The recorded value is always kept
// (`disposition`) and shown as "as recorded" on the case page; this module only produces the label used for chips, facets and filters.
const SAME: Record<string, string> = {
  "appeal(s) allowed": "Allowed", "appeals allowed": "Allowed", "appeal allowed": "Allowed", "case allowed": "Allowed", "allowed": "Allowed",
  "dismissed": "Dismissed", "appeal(s) dismissed": "Dismissed", "appeals dismissed": "Dismissed", "appeal dismissed": "Dismissed",
  "case partly allowed": "Partly allowed", "partly allowed": "Partly allowed", "appeal(s) partly allowed": "Partly allowed",
  "disposed off": "Disposed of", "disposed of": "Disposed of", "disposed": "Disposed of",
  "leave granted & allowed": "Leave granted and allowed", "leave granted & dismissed": "Leave granted and dismissed", "leave granted & disposed off": "Leave granted and disposed of",
};
/** Label for a recorded disposition: known equivalents are unified; anything else keeps its own meaning, only sentence-cased ("&" read as "and"). Never invents an outcome. */
export function displayDisposition(raw?: string | null): string | undefined {
  const t = raw?.trim().replace(/\s+/g, " ");
  if (!t) return undefined;
  const k = t.toLowerCase();
  if (SAME[k]) return SAME[k];
  const s = k.replace(/\s*&\s*/g, " and ").replace(/\bdisposed off\b/g, "disposed of").replace(/\bslp\b/g, "SLP").replace(/\bias?\b/g, (m) => m.toUpperCase()).replace(/\bhigh court\b/g, "High Court");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
