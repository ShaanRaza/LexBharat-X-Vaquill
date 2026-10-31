export const MAX_Q: number, MIN_Q: number;
export const ACT_ALIASES: Record<string, string>;
export function normalizeQuery(raw: unknown): { q: string; error?: undefined } | { error: string; q?: undefined };
export function parseSectionLookup(q: string): { number: string; numbers?: string[]; actPhrase: string } | null;
export function parseScheduleLookup(q: string): { number: string; numbers?: string[]; actPhrase: string } | null;
export function actMatcher(actPhrase: string, opts?: { noAlias?: boolean }): { titlePrefix: string | null; words: string[] };
export function hasDevanagari(q: string): boolean;
export function hasSearchableChars(q: string): boolean;
