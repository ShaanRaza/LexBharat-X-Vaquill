export function hasQuotedPhrase(q: string): boolean;
export function chooseMode(q: string, opts?: { exact?: boolean; hindi?: boolean; semanticReady?: boolean }): { mode: "semantic" | "text"; reason: "exact_requested" | "quoted_phrase" | "hindi" | "semantic_unavailable" | null };
export function cacheKey(q: string): string;
export class LruCache<V = unknown> { constructor(max?: number); get(k: string): V | undefined; set(k: string, v: V): void; readonly size: number }
export function createRateLimiter(opts?: { limit?: number; windowMs?: number; maxKeys?: number; now?: () => number }): { check(key: string): { ok: boolean; retryAfterSec: number } };
export function clientKey(headers: { get(name: string): string | null }): string;
export function vectorLiteral(v: ArrayLike<number>): string;
export function distinctSections<T extends { actId: string; sectionKey: string; distance?: number }>(rows: T[], limit?: number): { actId: string; sectionKey: string; distance: number }[];
export const NOT_IN_FORCE_SEMANTIC: number;
export const CENTRAL_SEMANTIC: number;
export const STATE_NAMED_SEMANTIC: number;
export function statesIn(q: string): Set<string>;
export function copyKey(title: string | null | undefined, number: string | null | undefined): string | null;
export type RankInfo = { actStatus: string; status: string; central?: boolean; title?: string | null; number?: string | null; state?: string | null };
export function rankSections(cands: { actId: string; sectionKey: string; distance: number }[], info: Map<string, RankInfo>, limit?: number, factor?: number, boosts?: { central?: number; state?: number; states?: Set<string> }): { actId: string; sectionKey: string; score: number; central: boolean; copies: number }[];
export function highlightQuery(q: string): string;
