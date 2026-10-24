export type Mention = { actKey: string; actName: string; kind: "section" | "order" | "rule" | "article"; number: string; start: number; end: number; text: string; order?: string; silent?: boolean; hidden?: boolean };
export const ACTS: { key: string; name: string; min?: number; re: string }[];
export function romanToInt(r: string): number;
export function findMentions(text: string, judgmentYear?: number | null): Mention[];
export function segments(text: string, mentions: Mention[]): { text: string; mention?: Mention }[];
export function mentionLabel(m: Mention): string;
