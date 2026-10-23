export const CHUNK_TARGET: number, CHUNK_MAX: number;
export function splitBody(paragraphs: string[], target?: number, max?: number): string[];
export function chunkSection(section: { actTitle: string; year?: number | null; number?: string | null; heading?: string | null; body: string | null }, opts?: { target?: number; max?: number }): { text: string; part: number; parts: number }[];
