// Section keys as stored are `s` + the number, zero-padded to 3 characters for most Acts (s061, s302, s065B; hand-built links use s61, 61, s0061, s012A...).
// Everything that READS a section key from a URL goes through resolveSectionKey, so any equivalent spelling finds the stored key. Stored keys are never changed.
// LOGIC ONLY: no JSX, no styling.

/** Canonical spelling for comparison: type letter lower-case, leading zeros of the number dropped, suffix upper-case ("s061" / "S61" / "61" -> "s61"; "s012a" -> "s12A"). Keys that are not letter + number (sAPP3, sO7R11, schedule) compare as lower-case text. */
export function normSectionKey(raw) {
  let k = String(raw ?? "").trim();
  if (!k) return "";
  if (/^\d/.test(k)) k = `s${k}`;
  const m = /^([a-z])0*(\d+)([a-z0-9]*)$/i.exec(k);
  return m ? `${m[1].toLowerCase()}${m[2]}${m[3].toUpperCase()}` : k.toLowerCase();
}

/** The stored key that `wanted` means, or null. Exact match first; then any equivalent spelling; then a confidently-missing number ("s16" can be the placeholder "m16"). */
export function resolveSectionKey(keys, wanted) {
  const w = String(wanted ?? "").trim();
  if (!w) return null;
  if (keys.includes(w)) return w;
  const n = normSectionKey(w);
  const hit = keys.find((k) => normSectionKey(k) === n);
  if (hit) return hit;
  const m = /^s(\d+)$/.exec(n);
  if (m) { const miss = keys.find((k) => normSectionKey(k) === `m${m[1]}`); if (miss) return miss; }
  return null;
}
