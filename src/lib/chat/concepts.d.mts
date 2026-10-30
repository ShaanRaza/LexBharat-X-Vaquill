export interface ConceptMatch { id: string; area: string; act: string; query: string; hits: number; hintOnly: boolean }
export function conceptMatches(question: string, concepts?: unknown[], max?: number): ConceptMatch[];
export function conceptHint(question: string): string;
export function conceptQueries(question: string, max?: number, existing?: string[]): string[];
