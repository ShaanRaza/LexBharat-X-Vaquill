// Plain-language meaning of the computed section flags (src/lib/acts/reassemble.mjs). LOGIC ONLY: `tone` is a meaning that the UI kit turns into a look;
// nothing here knows about colours, classes or components.
import type { AssembledSection, SectionStatus } from "./reassemble.mjs";

/** Plain wording shown wherever a section is flagged "possibly incomplete" (Act page and search results), next to a link to the Act on India Code. */
export const INCOMPLETE_NOTICE = "This section may be incomplete or mixed with nearby text in the source data. Check India Code before relying on it.";

export type Tone = "neutral" | "complete" | "warn" | "bad" | "info";
export type FlagInfo = { label: string; tone: Tone; explain: string };

export const STATUS_INFO: Record<SectionStatus, FlagInfo> = {
  complete: { label: "No problems detected", tone: "complete", explain: "No lost characters, missing parts or mismatched headers were found in this section's text. This is an automatic check, not proof that it matches the official text." },
  possibly_incomplete: { label: "Possibly incomplete", tone: "warn", explain: INCOMPLETE_NOTICE },
  garbled: { label: "Text unreliable", tone: "bad", explain: "The text of this section is unreliable in the source dataset (scrambled characters from PDF extraction)." },
};

/** Shown for a section number we are confident is missing from the source data (rule: gaps.mjs). */
export const MISSING_NOTICE = "This section is missing from our source data. Read it on India Code.";
export const MISSING_INFO: FlagInfo = { label: "Missing from our source data", tone: "info", explain: MISSING_NOTICE };

export const FLAG_INFO: Record<string, FlagInfo> = {
  devanagari: { label: "Contains Hindi", tone: "info", explain: "This section includes Devanagari (Hindi) text." },
  no_section_number: { label: "No section number", tone: "info", explain: "The dataset has no section number for this text, so it cannot be placed in the Act's numbering." },
  other_indic: { label: "Other Indian script", tone: "info", explain: "This section includes text in another Indian script." },
  duplicates_collapsed: { label: "Repeated chunks merged", tone: "info", explain: "Identical repeated pieces of text in the dataset were shown once." },
  lost_characters: { label: "Lost characters", tone: "warn", explain: "Some characters were lost when the source was extracted (shown as a replacement mark in the data)." },
  part_gap: { label: "Missing part", tone: "warn", explain: "A numbered part of this section is missing from the dataset." },
  sub_gap: { label: "Missing sub-section", tone: "warn", explain: "A sub-section number is skipped in the dataset's pieces (for example (4) then (6))." },
  mixed_structure: { label: "Pieces of mixed kinds", tone: "warn", explain: "The dataset stores this section in pieces of different kinds, so their reading order is a best guess." },
  hindi_pieces_hidden: { label: "Hindi pieces not shown", tone: "warn", explain: "Hindi text in the dataset cannot be checked automatically (it is often scrambled), so those pieces are left out here. The English text is shown." },
  hindi_unverifiable: { label: "Hindi text not shown", tone: "bad", explain: "This section is in Hindi in the dataset and cannot be checked automatically, so it is not shown." },
  header_mismatch: { label: "Piece filed under another section", tone: "warn", explain: "At least one piece of this section is labelled with a different section number in the dataset." },
};

/** Flags worth listing for one section, in a stable order: problems first, then information. */
export function sectionFlagList(s: Pick<AssembledSection, "status" | "flags">): { key: string; info: FlagInfo }[] {
  const order = ["lost_characters", "part_gap", "sub_gap", "mixed_structure", "header_mismatch", "hindi_pieces_hidden", "hindi_unverifiable", "devanagari", "other_indic", "no_section_number", "duplicates_collapsed"];
  return order.filter((k) => s.flags.includes(k)).map((k) => ({ key: k, info: FLAG_INFO[k] }));
}

export const CHAPTER_NOTE = "Chapter labels appear only when they pass automatic checks.";

import { INDIA_CODE, INDIA_CODE_HOME as LIVE_HOME, liveIndiaCodeUrl } from "../docs/docType.mjs";
export const INDIA_CODE_HOME = LIVE_HOME;
/** Link to the official source: India Code's search for the Act when `actTitle` is given (the dataset's own address is the old India Code site, which no longer opens), otherwise the stored address, otherwise the India Code home page.
 *  Without a title the stored address is kept so that sourceInfo (docs/docType.mjs), which knows the title, can turn it into the search link. */
export const officialSourceUrl = (sourceUrl: string | null | undefined, actTitle?: string | null) => (sourceUrl && INDIA_CODE.test(sourceUrl) ? (actTitle ? liveIndiaCodeUrl(sourceUrl, actTitle) : sourceUrl) : INDIA_CODE_HOME);

export const PROVENANCE = {
  dataset: "open-india-law (Vaquill AI), compiled from India Code, the Government of India's official repository",
  datasetUrl: "https://huggingface.co/datasets/vaquill/open-india-law",
  licence: "CC BY 4.0",
  snapshot: "v2026.08",
} as const;
