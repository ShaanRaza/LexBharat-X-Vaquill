export type Match = { start: number; end: number };
export type Piece = { text: string; href?: string; title?: string; hit?: boolean; active?: boolean };
export function findMatches(text: string, query: string): Match[];
export function buildSegments(text: string, mentions?: { start: number; end: number; href?: string | null; title?: string }[], hits?: Match[], activeStart?: number): Piece[];
export function leadingNumber(text: string): number | null;
export function paragraphRequest(q: string): number | null;
