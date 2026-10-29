export function stem(w: string): string;
export function contentTokens(text: string): string[];
export function expandQuery(q: string, rules?: { when: string[]; add: string }[]): { text: string; added: string[] };
export function lexicalBoost(tokens: string[], heading: string | null | undefined, lead: string | null | undefined): number;
export function hybridOrder(semantic: string[], keyword: string[]): string[];
export function contentWords(text: string): string[];
