export const CONFIDENT_DENSITY: number, CONFIDENT_MAX_RUN: number;
export function maxCitedSection(texts: string[]): number;
export function findGaps(numbers: (string | null)[], citedMax?: number, knownMax?: number): { expectedMax: number; held: number; density: number; missing: number[]; confident: number[]; uncertain: number[]; severe: boolean };
export function startsWithOwnNumber(number: string, body: string | null): boolean | null;
export function robustMax(present: Iterable<number>): number;
