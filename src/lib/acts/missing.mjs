// The section numbers we are confident are missing from one Act's data. PURE logic; the rule and its limits are in gaps.mjs and docs/MISSING-SECTIONS.md.
import { findGaps, maxCitedSection, robustMax } from "./gaps.mjs";
import { knownMaxFor } from "./knownCounts.mjs";

/** sections: [{ number: string | null, body: string | null }] (unnumbered blocks have number null). Returns { numbers, expectedMax, density }. */
export function confidentMissing(sections, title) {
  const nums = sections.map((s) => s.number).filter(Boolean);
  const heldMax = robustMax(nums.map((n) => parseInt(n, 10) || 0).filter(Boolean));
  const g = findGaps(nums, maxCitedSection(sections.map((s) => s.body ?? ""), heldMax), knownMaxFor(title));
  return { numbers: g.confident, expectedMax: g.expectedMax, density: g.density };
}
