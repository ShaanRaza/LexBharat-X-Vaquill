import type { AssembledSection } from "./reassemble.mjs";
export type SectionRecord = { sectionKey: string; ord: number; number: string | null; heading: string | null; chapter: string | null; status: AssembledSection["status"]; flags: string[]; chunkCount: number; body: string | null };
export function chapterLabel(section: Pick<AssembledSection, "chapter">): string | null;
export function shownNumber(section: Pick<AssembledSection, "kind" | "number">): string | null;
export function toSectionRecord(section: AssembledSection, ord: number): SectionRecord;
