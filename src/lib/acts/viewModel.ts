// Builds the plain data the Act text page shows from section RECORDS (the same shape whether they came from Neon or from the local files).
// LOGIC ONLY: no JSX, no classes, no colours (tones are meanings the UI kit maps to a look).
import { toDisplayBlocks, cleanHeading, type DisplayBlock } from "./cleanText.mjs";
import type { SectionRecord } from "./sectionRecord.mjs";
import { unitLabel, parseUnitNumber } from "./unitLabel.mjs";
import type { ScheduleTable } from "./scheduleTable.mjs";
import { STATUS_INFO, MISSING_INFO, sectionFlagList, officialSourceUrl, type FlagInfo, type Tone } from "./quality";

/** A stored section; `body` may be left out for sections that are only listed (the page needs the text of the selected one). */
export type SupplementSource = { source: string; sourceUrl: string; copiedOn: string };
export type ListedSection = Omit<SectionRecord, "body"> & { body?: string | null; /** set for a section filled in by hand (content/supplement): where and when it was copied */ supplement?: SupplementSource };

/** Schedule units the official PDF does not print (src/config/schedule-gaps.json): shown as a placeholder row with its own note. */
export type ScheduleGaps = { kind: string; numbers: number[]; note: string } | null | undefined;
export type SectionListItem = { supplemented: boolean; key: string; label: string; heading: string | null; status: SectionRecord["status"] | "missing"; tone: Tone; statusLabel: string; noNumber: boolean; missing: boolean };
export type SectionView = {
  key: string; label: string; heading: string | null;
  /** Only present when the chapter label passed every check. */
  chapter: string | null;
  status: SectionRecord["status"] | "missing"; statusInfo: FlagInfo; flags: { key: string; info: FlagInfo }[];
  /** True for a section number we are confident is missing from the source data: there is no text, only the notice. */
  missing: boolean;
  /** A short note for a placeholder row that is not a missing section (a Schedule unit the PDF does not print). */
  note: string | null;
  /** Set for a section filled in by hand: shown as "Source: India Code, copied <date>" instead of the machine-extraction quality badges. */
  supplement: SupplementSource | null;
  /** null for garbled or missing sections: the text is never handed to the UI. */
  blocks: DisplayBlock[] | null; chunkCount: number;
  prev: { key: string; label: string } | null; next: { key: string; label: string } | null;
};
export type ActTextView = {
  hasSectionNumbers: boolean; sourceUrl: string;
  /** the Act has Schedule Articles stored as units (Limitation Act, Stamp Act): the page offers them as a table. `schedule` is set when the table is the page being shown. */
  hasSchedule: boolean; schedule: ScheduleTable | null;
  list: SectionListItem[]; counts: { sections: number; complete: number; possibly_incomplete: number; garbled: number; missing: number; supplemented: number };
  selected: SectionView | null;
};

type Row = { kind: "section"; s: ListedSection; label: string } | { kind: "missing"; n: number; label: string } | { kind: "gap"; n: number; label: string; note: string };
const baseNumber = (n: string | null) => { const m = /^(\d{1,4})/.exec(n ?? ""); return m ? Number(m[1]) : null; };

/** Sections in reading order with a placeholder for every confidently-missing number put where it belongs. */
function rowsFor(sections: ListedSection[], missing: number[], gaps?: ScheduleGaps): Row[] {
  const rows: Row[] = [], todo = [...missing].sort((a, b) => a - b), gapTodo = gaps ? [...gaps.numbers].sort((a, b) => a - b) : [];
  const flushGaps = (before: number) => { while (gaps && gapTodo.length && gapTodo[0] < before) { const n = gapTodo.shift() as number; rows.push({ kind: "gap", n, label: `${gaps.kind} ${n}`, note: gaps.note }); } };
  let blocks = 0;
  for (const s of sections) {
    const b = baseNumber(s.number);
    if (parseUnitNumber(s.number)) while (todo.length) { const n = todo.shift() as number; rows.push({ kind: "missing", n, label: String(n) }); }   // placeholders for sections still missing come before the Schedule units
    if (b !== null) while (todo.length && todo[0] < b) { const n = todo.shift() as number; rows.push({ kind: "missing", n, label: String(n) }); }
    if (gaps && /^A\d/.test(s.number ?? "")) flushGaps(parseInt((s.number as string).slice(1), 10));
    rows.push({ kind: "section", s, label: s.number ? (unitLabel(s.number) ?? s.number) : `Text block ${++blocks}` });
  }
  for (const n of todo) rows.push({ kind: "missing", n, label: String(n) });
  flushGaps(Infinity);
  return rows;
}
const keyOf = (r: Row) => (r.kind === "missing" ? `m${r.n}` : r.kind === "gap" ? `g${r.n}` : r.s.sectionKey);

/** The key that will be shown: the wanted one when it exists (a missing number can be asked for as "s016" or "m16"), otherwise the first section. */
export function selectedKey(rows: { key: string }[], wanted: string | undefined) {
  if (wanted && rows.some((r) => r.key === wanted)) return wanted;
  const m = /^s0*(\d+)$/i.exec(wanted ?? "");
  if (m && rows.some((r) => r.key === `m${m[1]}`)) return `m${m[1]}`;
  return rows[0]?.key;
}

export function buildActTextView(sections: ListedSection[], sourceUrl: string | null | undefined, wantedKey: string | undefined, missing: number[] = [], gaps?: ScheduleGaps): ActTextView {
  const rows = rowsFor(sections, missing, gaps), keys = rows.map((r) => ({ key: keyOf(r) }));
  const list: SectionListItem[] = rows.map((r) => r.kind === "gap"
    ? { supplemented: false, key: keyOf(r), label: r.label, heading: null, status: "missing", tone: "info", statusLabel: "Not printed in the source PDF", noNumber: false, missing: true }
    : r.kind === "missing"
    ? { supplemented: false, key: keyOf(r), label: r.label, heading: null, status: "missing", tone: "info", statusLabel: "Missing from our source data", noNumber: false, missing: true }
    : { supplemented: r.s.flags.includes("supplement"), key: keyOf(r), label: r.label, heading: cleanHeading(r.s.heading), status: r.s.status, tone: STATUS_INFO[r.s.status].tone, statusLabel: STATUS_INFO[r.s.status].label, noNumber: r.s.flags.includes("no_section_number"), missing: false });
  const counts = { sections: sections.length, complete: 0, possibly_incomplete: 0, garbled: 0, missing: missing.length, supplemented: 0 };
  for (const s of sections) { if (s.flags.includes("supplement")) counts.supplemented++; else counts[s.status]++; }
  const key = selectedKey(keys, wantedKey), idx = rows.findIndex((r) => keyOf(r) === key);
  const r = idx >= 0 ? rows[idx] : undefined;
  const near = (i: number) => (i >= 0 && i < rows.length ? { key: keyOf(rows[i]), label: rows[i].label } : null);
  const selected: SectionView | null = !r ? null : r.kind === "gap"
    ? { key: keyOf(r), label: r.label, heading: null, chapter: null, status: "missing", statusInfo: { ...MISSING_INFO, label: "Not printed in the source PDF", explain: r.note }, flags: [], missing: true, note: r.note, supplement: null, blocks: null, chunkCount: 0, prev: near(idx - 1), next: near(idx + 1) }
    : r.kind === "missing"
    ? { key: keyOf(r), label: r.label, heading: null, chapter: null, status: "missing", statusInfo: MISSING_INFO, flags: [], missing: true, note: null, supplement: null, blocks: null, chunkCount: 0, prev: near(idx - 1), next: near(idx + 1) }
    : { key: keyOf(r), label: r.label, heading: cleanHeading(r.s.heading), chapter: r.s.chapter, status: r.s.status, statusInfo: STATUS_INFO[r.s.status], flags: sectionFlagList(r.s), missing: false, note: null, supplement: r.s.supplement ?? null,
        blocks: r.s.status === "garbled" || r.s.body == null ? null : toDisplayBlocks(r.s.body), chunkCount: r.s.chunkCount, prev: near(idx - 1), next: near(idx + 1) };
  return { hasSectionNumbers: sections.some((x) => x.number), hasSchedule: sections.some((x) => /^A\d/.test(x.number ?? "")), schedule: null, sourceUrl: officialSourceUrl(sourceUrl), list, counts, selected };
}
