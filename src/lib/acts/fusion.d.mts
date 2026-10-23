export function rrf(lists: string[][], k?: number): string[];
export function dedupe<T>(list: T[]): T[];
export function firstHitRank(list: string[], gold: Set<string>): number | null;
export function hitRates(ranks: (number | null)[], ks?: number[]): Record<number, number>;
export function truncateNormalize(vec: ArrayLike<number>, dim: number): number[];
