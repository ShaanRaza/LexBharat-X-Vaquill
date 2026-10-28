export const MIN_CHARS: number;
export function looksLikeCitation(q: string): boolean;
export function looksLikeCaseName(q: string): boolean;
export function groupOrder(q: string, numeric?: boolean): ("go" | "laws" | "mentions" | "judgments" | "work")[];
export const SHORTCUTS: readonly { id: "drafts" | "reviews" | "vault"; label: string; words: string[]; feature: "drafting" | "review" | "vault" }[];
export function matchShortcuts(q: string, enabled?: string[]): { id: "drafts" | "reviews" | "vault"; label: string; words: string[]; feature: "drafting" | "review" | "vault" }[];
export function matchWork<T extends { title: string; updatedAt?: string }>(items: T[], q: string, limit?: number): T[];
export function topResult<T>(groups: Record<string, T[]>, order: string[]): { group: string; item: T } | null;
