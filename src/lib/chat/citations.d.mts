export type Piece = { type: "text"; text: string } | { type: "cite"; n: number } | { type: "statute"; text: string; n: number };
export function citedNumbers(text: string): number[];
export function sanitizeCitations(text: string, max: number): { text: string; invalid: number[] };
export function linkSegments(text: string, sources: { n: number; number: string | null; actTitle: string; actId?: string }[]): Piece[];
export function resolveMention<T extends { n: number; number: string | null; actTitle: string }>(number: string, named: string | undefined, sources: T[]): T | null;
export function findStatuteMentions<T extends { n: number; number: string | null; actTitle: string }>(text: string, sources: T[]): { text: string; number: string; act: string; source: T | null }[];
export function ensureCitations<T extends { n: number; number: string | null; actTitle: string }>(text: string, sources: T[]): string;
export function alignCitations(text: string, sources: { n: number; number: string | null; actTitle: string }[]): string;
export function displayNumbers(text: string, sources: { n: number }[]): Map<number, number>;
