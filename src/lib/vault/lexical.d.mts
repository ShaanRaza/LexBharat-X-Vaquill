export function terms(s: string): string[];
export function lexicalRank<T extends { body: string; label?: string | null }>(query: string, passages: T[], k?: number): T[];
