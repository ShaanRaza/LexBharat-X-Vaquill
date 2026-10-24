export function parseUnitNumber(number: string | null | undefined): { kind: "order" | "rule" | "article"; order?: string; rule?: string; article?: string } | null;
export function unitLabel(number: string | null | undefined): string | null;
export function unitOrd(number: string, afterOrd: number): number | null;
export function sectionWord(number: string): string;
