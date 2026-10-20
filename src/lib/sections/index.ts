// Section-text seam (Phase 3). INTENTIONALLY EMPTY IN PRODUCTION: reconstructed section text is not served because chunk ordering has not been validated
// to a production standard (docs/CHUNK-ORDER-VALIDATION.md). Nothing here orders, joins or concatenates chunks.
// When a validated pipeline exists, implement SectionsStore (for example reading per-act files from S3 or rows from Postgres) and return it from
// getSectionsStore() behind an explicit env flag; the route and UI contract below do not change.
export type SectionText = { sectionNumber: string; title?: string; text: string };
export type SectionsResult = { available: true; sections: SectionText[] } | { available: false; reason: string };
export interface SectionsStore { get(actId: string): Promise<SectionsResult> }

const unavailable: SectionsStore = {
  async get() { return { available: false, reason: "Section text is not available yet. Chunk ordering has not been validated, so no text is reconstructed or served." }; },
};
export const getSectionsStore = (): SectionsStore => unavailable;
