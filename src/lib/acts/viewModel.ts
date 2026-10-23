// Builds the plain data the Act text page shows. LOGIC ONLY: no JSX, no classes, no colours (tones are meanings the UI kit maps to a look).
import { toDisplayBlocks, cleanHeading, type DisplayBlock } from "./cleanText.mjs";
import type { AssembledSection } from "./reassemble.mjs";
import { STATUS_INFO, sectionFlagList, officialSourceUrl, type FlagInfo, type Tone } from "./quality";
import type { ActTextDoc } from "./sectionText";

export type SectionListItem = { key: string; label: string; heading: string | null; status: AssembledSection["status"]; tone: Tone; statusLabel: string; noNumber: boolean };
export type SectionView = {
  key: string; label: string; heading: string | null;
  /** Shown only when the chapter label passed every check; `chapterHidden` is true when the dataset has a label that did not. */
  chapter: string | null; chapterHidden: boolean;
  status: AssembledSection["status"]; statusInfo: FlagInfo; flags: { key: string; info: FlagInfo }[];
  /** null for garbled sections: the text is never handed to the UI. */
  blocks: DisplayBlock[] | null; chunkCount: number;
  prev: { key: string; label: string } | null; next: { key: string; label: string } | null;
};
export type ActTextView = {
  hasSectionNumbers: boolean; sourceUrl: string;
  list: SectionListItem[]; counts: { sections: number; complete: number; possibly_incomplete: number; garbled: number };
  selected: SectionView | null;
};

const labelOf = (s: AssembledSection, blockIndex: number) => (s.kind === "s" && s.number ? s.number : `Text block ${blockIndex}`);

export function buildActTextView(doc: ActTextDoc, wantedKey: string | undefined): ActTextView {
  let b = 0;
  const labels = doc.sections.map((s) => labelOf(s, s.kind === "s" && s.number ? 0 : ++b));
  const list: SectionListItem[] = doc.sections.map((s, i) => ({
    key: s.key, label: labels[i], heading: cleanHeading(s.heading), status: s.status, tone: STATUS_INFO[s.status].tone, statusLabel: STATUS_INFO[s.status].label, noNumber: s.flags.includes("no_section_number"),
  }));
  const counts = { sections: doc.sections.length, complete: 0, possibly_incomplete: 0, garbled: 0 };
  for (const s of doc.sections) counts[s.status]++;
  const idx = Math.max(0, doc.sections.findIndex((s) => s.key === wantedKey));
  const s = doc.sections[idx];
  const selected: SectionView | null = s ? {
    key: s.key, label: labels[idx], heading: cleanHeading(s.heading),
    chapter: s.chapter ? [`Chapter ${s.chapter.roman}`, cleanHeading(s.chapter.name)].filter(Boolean).join(" — ") : null,
    chapterHidden: !s.chapter && s.chapterRaw !== null,
    status: s.status, statusInfo: STATUS_INFO[s.status], flags: sectionFlagList(s),
    blocks: s.status === "garbled" ? null : toDisplayBlocks(s.displayText ?? s.text), chunkCount: s.chunkCount,
    prev: idx > 0 ? { key: doc.sections[idx - 1].key, label: labels[idx - 1] } : null,
    next: idx < doc.sections.length - 1 ? { key: doc.sections[idx + 1].key, label: labels[idx + 1] } : null,
  } : null;
  return { hasSectionNumbers: doc.hasSectionNumbers, sourceUrl: officialSourceUrl(doc.sourceUrl), list, counts, selected };
}
