// Builds the plain data the Act text page shows from section RECORDS (the same shape whether they came from Neon or from the local files).
// LOGIC ONLY: no JSX, no classes, no colours (tones are meanings the UI kit maps to a look).
import { toDisplayBlocks, cleanHeading, type DisplayBlock } from "./cleanText.mjs";
import type { SectionRecord } from "./sectionRecord.mjs";
import { STATUS_INFO, sectionFlagList, officialSourceUrl, type FlagInfo, type Tone } from "./quality";

/** A stored section; `body` may be left out for sections that are only listed (the page needs the text of the selected one). */
export type ListedSection = Omit<SectionRecord, "body"> & { body?: string | null };

export type SectionListItem = { key: string; label: string; heading: string | null; status: SectionRecord["status"]; tone: Tone; statusLabel: string; noNumber: boolean };
export type SectionView = {
  key: string; label: string; heading: string | null;
  /** Only present when the chapter label passed every check. */
  chapter: string | null;
  status: SectionRecord["status"]; statusInfo: FlagInfo; flags: { key: string; info: FlagInfo }[];
  /** null for garbled sections: the text is never handed to the UI. */
  blocks: DisplayBlock[] | null; chunkCount: number;
  prev: { key: string; label: string } | null; next: { key: string; label: string } | null;
};
export type ActTextView = {
  hasSectionNumbers: boolean; sourceUrl: string;
  list: SectionListItem[]; counts: { sections: number; complete: number; possibly_incomplete: number; garbled: number };
  selected: SectionView | null;
};

export function labelsFor(sections: Pick<ListedSection, "number">[]): string[] {
  let b = 0;
  return sections.map((s) => (s.number ? s.number : `Text block ${++b}`));
}

/** The key that will be shown: the wanted one when it exists, otherwise the first section. */
export const selectedKey = (sections: Pick<ListedSection, "sectionKey">[], wanted: string | undefined) => (sections.find((s) => s.sectionKey === wanted) ?? sections[0])?.sectionKey;

export function buildActTextView(sections: ListedSection[], sourceUrl: string | null | undefined, wantedKey: string | undefined): ActTextView {
  const labels = labelsFor(sections);
  const list: SectionListItem[] = sections.map((s, i) => ({
    key: s.sectionKey, label: labels[i], heading: cleanHeading(s.heading), status: s.status, tone: STATUS_INFO[s.status].tone, statusLabel: STATUS_INFO[s.status].label, noNumber: s.flags.includes("no_section_number"),
  }));
  const counts = { sections: sections.length, complete: 0, possibly_incomplete: 0, garbled: 0 };
  for (const s of sections) counts[s.status]++;
  const key = selectedKey(sections, wantedKey), idx = sections.findIndex((s) => s.sectionKey === key);
  const s = idx >= 0 ? sections[idx] : undefined;
  const selected: SectionView | null = s ? {
    key: s.sectionKey, label: labels[idx], heading: cleanHeading(s.heading), chapter: s.chapter,
    status: s.status, statusInfo: STATUS_INFO[s.status], flags: sectionFlagList(s),
    blocks: s.status === "garbled" || s.body == null ? null : toDisplayBlocks(s.body), chunkCount: s.chunkCount,
    prev: idx > 0 ? { key: sections[idx - 1].sectionKey, label: labels[idx - 1] } : null,
    next: idx < sections.length - 1 ? { key: sections[idx + 1].sectionKey, label: labels[idx + 1] } : null,
  } : null;
  return { hasSectionNumbers: sections.some((x) => x.number), sourceUrl: officialSourceUrl(sourceUrl), list, counts, selected };
}
