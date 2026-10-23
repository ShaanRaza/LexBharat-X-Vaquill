export type Piece = { type: "text"; text: string } | { type: "cite"; n: number } | { type: "statute"; text: string; n: number };
export function citedNumbers(text: string): number[];
export function sanitizeCitations(text: string, max: number): { text: string; invalid: number[] };
export function linkSegments(text: string, sources: { n: number; number: string | null; actTitle: string }[]): Piece[];
