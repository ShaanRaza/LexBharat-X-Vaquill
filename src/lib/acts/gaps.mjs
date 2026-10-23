// Which section numbers of an Act are missing from our data, and how sure we are. PURE logic (no files, no styling).
// An Indian Act numbers its sections 1, 2, 3 ... without skipping (omitted sections stay as "[Omitted]" entries), so an integer absent from 1..N is very likely
// absent from our data, not from the Act. N is not known exactly: it is the highest section number we hold or that the Act's own text cites ("see section 135").
// "Confident" is deliberately strict (it drives a visible message): the Act must hold at least 85% of 1..N, and the gap must be short (5 or fewer in a row).

export const CONFIDENT_DENSITY = 0.85, CONFIDENT_MAX_RUN = 5;
const baseInt = (n) => { const m = /^(\d{1,4})(?:[A-Za-z]{0,3}(?:-[A-Za-z0-9]+)?)?$/.exec(String(n ?? "").trim()); return m ? Number(m[1]) : null; };

/** Highest held number that is not an isolated straggler (a schedule row or a mis-read number): at least 3 held numbers lie within 12 below it (or it is the only way to count at all). */
export function robustMax(present) {
  const arr = [...present].sort((a, b) => b - a);
  for (const n of arr) if (arr.filter((m) => m <= n && m > n - 12).length >= 3) return n;
  return arr[0] ?? 0;
}

/** Highest plausible section number the Act's own text refers to as "section N" without naming another Act right after it. */
export function maxCitedSection(texts, heldMax = 0) {
  let max = 0;
  const cap = Math.max(60, heldMax * 2); // a citation far beyond what we hold is far more likely a year, an Order number or another Act's section than this Act's last section
  for (const t of texts) for (const m of t.matchAll(/\bsections?\s+(\d{1,4})[A-Z]?\b(?![^.;\n]{0,24}?\b(?:of|under)\s+(?:the\s+)?(?!this\b)[A-Z][\w ,'()-]{0,50}?\b(?:Act|Code|Sanhita|Constitution)\b)/g)) { const n = Number(m[1]); if (!(n >= 1800 && n <= 2100) && n <= cap) max = Math.max(max, n); }
  return max;
}

/** numbers: section numbers held (strings, may include 12A); citedMax: from maxCitedSection (0 if unknown); knownMax: a reference count from knownCounts.mjs (0 if none). */
export function findGaps(numbers, citedMax = 0, knownMax = 0) {
  const present = new Set(numbers.map(baseInt).filter((n) => n !== null && n > 0));
  const heldMax = robustMax(present);
  const expectedMax = knownMax > 0 ? knownMax : Math.min(Math.max(heldMax, citedMax), 3000); // knownMax: see knownCounts.mjs
  if (!expectedMax) return { expectedMax: 0, held: 0, density: 0, missing: [], confident: [], uncertain: [], severe: false };
  const missing = [];
  for (let n = 1; n <= expectedMax; n++) if (!present.has(n)) missing.push(n);
  const held = expectedMax - missing.length, density = held / expectedMax;
  // runs of consecutive missing numbers
  const runs = []; for (const n of missing) { const r = runs.at(-1); if (r && r.end === n - 1) r.end = n; else runs.push({ start: n, end: n }); }
  const okDensity = density >= CONFIDENT_DENSITY;
  const confident = [], uncertain = [];
  for (const r of runs) for (let n = r.start; n <= r.end; n++) (okDensity && r.end - r.start + 1 <= CONFIDENT_MAX_RUN ? confident : uncertain).push(n);
  return { expectedMax, held, density, missing, confident, uncertain, severe: density < 0.5 };
}

/** Does the section's text start with its own number ("**138. Dishonour ...", "138. ...")? null when the text is empty. */
export function startsWithOwnNumber(number, body) {
  if (!body) return null;
  const head = body.replace(/^[\s#>*_\-|]+/, "").slice(0, 60);
  const m = /^(?:section\s+)?(\d{1,4}[A-Za-z]{0,3})\s*[.\-—:)(]/i.exec(head);
  if (!m) return null;
  return m[1].toUpperCase() === String(number).toUpperCase();
}
