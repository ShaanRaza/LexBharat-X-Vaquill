export type AmendPart = { t: "text"; v: string } | { t: "mark"; n: number };
export function vocabOf(paragraphs: string[]): Set<string>;
export function amendParts(text: string, vocab?: Set<string>): AmendPart[];
