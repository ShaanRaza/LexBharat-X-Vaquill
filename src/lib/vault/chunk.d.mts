export type RawChunk = { idx: number; page: number | null; label: string | null; body: string };
export function chunkPages(pages: (string | null)[], opts?: { chars?: number; overlap?: number }): RawChunk[];
export function toUnits(pages: (string | null)[]): { page: number | null; text: string; heading: string | null }[];
export function pageAt(starts: number[], offset: number): number;
