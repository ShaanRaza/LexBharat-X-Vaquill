// Section-text seam for GET /api/acts/<id>/sections. Serves from Neon (DATABASE_URL) or the local files (ACTS_TEXT_DATA_DIR); otherwise { available: false }.
// Chunk order is a documented rule, not ground truth, so every section carries flags (docs/ACTS-TEXT-W1A.md). Garbled text is never returned.
import { query, dbConfigured } from "@/lib/acts/db";
import { getActText } from "@/lib/acts/sectionText";
import { toSectionRecord } from "@/lib/acts/sectionRecord.mjs";

export type SectionText = { sectionNumber: string | null; title?: string; text: string; status: string; flags: string[] };
export type SectionsResult = { available: true; sections: SectionText[] } | { available: false; reason: string };
export interface SectionsStore { get(actId: string): Promise<SectionsResult> }

const store: SectionsStore = {
  async get(actId) {
    if (dbConfigured()) {
      try {
        const rows = await query<{ number: string | null; heading: string | null; body: string | null; status: string; flags: string[] }>(`SELECT number, heading, body, status, flags FROM act_sections WHERE act_id = $1 ORDER BY ord`, [actId]);
        if (rows.length) return { available: true, sections: rows.map((r) => ({ sectionNumber: r.number, title: r.heading ?? undefined, text: r.status === "garbled" ? "" : r.body ?? "", status: r.status, flags: r.flags })) };
      } catch { /* fall through to files */ }
    }
    const t = await getActText(actId);
    if (t.available) return { available: true, sections: t.doc.sections.map((s, i) => { const r = toSectionRecord(s, i); return { sectionNumber: r.number, title: r.heading ?? undefined, text: r.body ?? "", status: r.status, flags: r.flags }; }) };
    return { available: false, reason: t.message };
  },
};
export const getSectionsStore = (): SectionsStore => store;
