export function clausePage(text: string, part: { start: number; end: number }, quote: string | undefined, pageStarts: number[] | null | undefined): number | null;
export function annotateClauses<T extends { quote?: string }>(clauses: T[], text: string, part: { start: number; end: number }, pageStarts: number[] | null | undefined, scanPages: number[] | null | undefined): (T & { page: number | null; scan?: boolean })[];
export function locate(piece: string, quote: string | undefined): number;
