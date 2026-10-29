export function sentencesCiting(answer: string, n: number): string[];
export function paragraphsOf(body: string | null | undefined): string[];
export function markParagraph(body: string | null | undefined, sentences: string[]): { paragraphs: string[]; marked: number };
