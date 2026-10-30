// Pure helpers for scripts/text/measure-marks.mjs: the read-only guard, the tallies and the report text. No database, no files.
import { cleanMarks, findMarks, otherBrackets, contextAround, AMBIGUOUS_RULES } from "../../src/lib/text/cleanMarks.mjs";

/** Only a single plain SELECT may pass. */
export function assertReadOnly(q) {
  if (!/^\s*select\b/i.test(q) || /;\s*\S/.test(q) || /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|vacuum|merge)\b/i.test(q.replace(/'[^']*'/g, "''")))
    throw new Error("refused: only a single SELECT is allowed");
  return q;
}
// ---- tallies
export const newTally = (label) => ({ label, total: null, scanned: 0, wouldChange: 0, withAmbiguous: 0, wouldChangeOnlyInAmbiguousFree: 0, kinds: new Map(), brackets: new Map() });
export function addKind(t, kind, group, id, example, note) {
  let k = t.kinds.get(kind);
  if (!k) t.kinds.set(kind, (k = { kind, group, rows: new Set(), occurrences: 0, examples: [], note }));
  k.rows.add(id); k.occurrences++;
  if (k.examples.length < 3 && !k.examples.some((e) => e.id === id)) k.examples.push({ id, text: example });
}
export function measureText(t, id, text, rowState) {
  const res = cleanMarks(text);
  if (res.changed) rowState.changed = true;
  const notes = new Map(AMBIGUOUS_RULES.map((r) => [r.kind, r.note]));
  for (const f of findMarks(text)) {
    if (f.group === "ambiguous") rowState.ambiguous = true;
    addKind(t, f.kind, f.group, id, contextAround(text, f.index, f.match.length), notes.get(f.kind));
  }
  for (const b of otherBrackets(text)) {
    const e = t.brackets.get(b.key) ?? { key: b.key, n: 0, example: contextAround(text, b.index, b.example.length, 40), id };
    e.n++; t.brackets.set(b.key, e);
  }
}
export function endRow(t, rowState) {
  t.scanned++;
  if (rowState.changed) t.wouldChange++;
  if (rowState.ambiguous) t.withAmbiguous++;
}

// ---- report
const pct = (a, b) => (b ? ` (${((100 * a) / b).toFixed(1)}%)` : "");
const cell = (s) => String(s).replace(/\|/g, "\\|");
export function report(tallies, { limit = Infinity } = {}) {
  const L = [];
  L.push("# Extraction marks: measurement (read-only)", "", `Rules: src/lib/text/cleanMarks.mjs. Nothing was changed. ${new Date().toISOString().slice(0, 10)}${Number.isFinite(limit) ? `, first ${limit} rows per source only` : ""}.`, "");
  L.push("## Summary", "", "| Content | Rows in table | Rows scanned | Rows the cleaner WOULD change | Rows with an ambiguous mark (not cleaned) |", "|---|---|---|---|---|");
  for (const t of tallies) L.push(t.skipped ? `| ${t.label} | skipped: ${t.skipped} | | | |` : `| ${t.label} | ${t.total} | ${t.scanned} | ${t.wouldChange}${pct(t.wouldChange, t.scanned)} | ${t.withAmbiguous}${pct(t.withAmbiguous, t.scanned)} |`);
  for (const t of tallies.filter((x) => !x.skipped)) {
    L.push("", `## ${t.label}`);
    for (const group of ["clean", "ambiguous"]) {
      const ks = [...t.kinds.values()].filter((k) => k.group === group).sort((a, b) => b.rows.size - a.rows.size);
      L.push("", group === "clean" ? "### Kinds the cleaner removes" : "### AMBIGUOUS kinds: could be real law, NOT cleaned, need your decision", "");
      if (!ks.length) { L.push("none found"); continue; }
      L.push("| Kind | Rows | Occurrences | Why | 3 real examples (id: text around the mark) |", "|---|---|---|---|---|");
      for (const k of ks) L.push(`| ${k.kind} | ${k.rows.size} | ${k.occurrences} | ${cell(k.note ?? "")} | ${k.examples.map((e) => cell(`${e.id}: …${e.text}…`)).join("<br>")} |`);
    }
    const br = [...t.brackets.values()].sort((a, b) => b.n - a.n).slice(0, 25);
    L.push("", "### Other bracketed text no rule explains (top 25 by count, digits shown as #)", "");
    if (!br.length) L.push("none"); else { L.push("| Bracket text | Count | Example |", "|---|---|---|"); for (const b of br) L.push(`| ${cell(b.key)} | ${b.n} | ${cell(`${b.id}: …${b.example}…`)} |`); }
  }
  return L.join("\n");
}

