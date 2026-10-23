// Section-text seam. Production default: NOT available. When ACTS_TEXT_DATA_DIR points at the output of scripts/acts/export-act-text.sh, the store serves
// reassembled text with computed quality flags (src/lib/acts/reassemble.mjs). Chunk order is a documented RULE, not ground truth, so every section carries
// flags and the route/UI show them (docs/CHUNK-ORDER-VALIDATION.md, docs/ACTS-TEXT-W1A.md). Garbled text is never returned.
import { getActText } from "@/lib/acts/sectionText";

export type SectionText = { sectionNumber: string | null; title?: string; text: string; status: string; flags: string[] };
export type SectionsResult = { available: true; sections: SectionText[] } | { available: false; reason: string };
export interface SectionsStore { get(actId: string): Promise<SectionsResult> }

const store: SectionsStore = {
  async get(actId) {
    const r = await getActText(actId);
    if (!r.available) return { available: false, reason: r.message };
    return {
      available: true,
      sections: r.doc.sections.map((s) => ({ sectionNumber: s.number, title: s.heading ?? undefined, text: s.status === "garbled" ? "" : s.text, status: s.status, flags: s.flags })),
    };
  },
};
export const getSectionsStore = (): SectionsStore => store;
