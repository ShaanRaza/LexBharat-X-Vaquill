export type ChunkId = { kind: "s" | "b"; token: string; key: string; subs: ({ n: number } | { s: string })[]; p: number | null; d: number | null };
export type SectionStatus = "complete" | "possibly_incomplete" | "garbled";
export type ChapterRef = { roman: string; name: string };
export type AssembledSection = {
  key: string; kind: "s" | "b"; token: string; number: string | null; heading: string | null;
  /** Chapter label as it appears in the dataset (unchanged), `{ conflict: [...] }` when chunks disagree, or null. */
  chapterRaw: ChapterRef | { conflict: string[] } | null;
  embeddedChapter: string | null;
  /** Chapter label that passed every check (null = do not show). */
  chapter: ChapterRef | null; chapterCheck: "pass" | string[];
  chunkIds: string[]; chunkCount: number;
  /** Raw text: chunk bodies joined by a blank line, dataset header lines removed, nothing else edited. */
  text: string;
  /** Text safe to show when some pieces were left out (unverifiable Hindi); null when it equals `text`. */
  displayText: string | null; status: SectionStatus; flags: string[];
};
export function parseChunkId(chunkId: string, actId: string): ChunkId | null;
export function compareTokens(a: string, b: string): number;
export function compareChunks(x: { id: ChunkId }, y: { id: ChunkId }): number;
export function splitHeader(text: string): { hadHeader: boolean; chapter: ChapterRef | null; sectionNo: string | null; sectionTitle: string | null; body: string };
export function mojibakeDevanagari(text: string): number;
export function mojibakeLatin(text: string): number;
export function hasLostCharacters(text: string): boolean;
export function hasDevanagari(text: string): boolean;
export function hasOtherIndic(text: string): boolean;
export function isGarbled(text: string): boolean;
export function devanagariCount(text: string): number;
export const HINDI_PIECE_MIN: number;
export function headingNameReliable(name: string): boolean;
export function embeddedChapter(body: string): string | null;
export function reassembleAct(rows: { actId: string; chunkId: string; sectionNumber: string | null; text: string }[]): { sections: AssembledSection[]; unparsed: string[] };
export function validateChapters(sections: AssembledSection[]): void;
export function countFlags(sections: Pick<AssembledSection, "status" | "flags">[], into?: Record<string, number>): Record<string, number>;
