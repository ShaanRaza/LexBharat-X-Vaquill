type Sec = { body?: string | null; heading?: string | null; number?: string | null };
type HeadingOf = (number: string) => string | null | undefined;
export function listEntries(text: string | null | undefined): { number: string; text: string; whole: string }[];
export function looksLikeContentsList(text: string | null | undefined, number: string | null | undefined): boolean;
export function confirmedByHeadings(text: string | null | undefined, headingOf?: HeadingOf, opts?: { min?: number; share?: number }): boolean;
export const STATUS_CONFIRM: { min: number; share: number };
export function headingIsContentsList(heading: string | null | undefined, headingOf?: HeadingOf): boolean;
export function isContentsList(section?: Sec, headingOf?: HeadingOf): boolean;
export function effectiveStatus<S extends string>(status: S, section?: Sec, headingOf?: HeadingOf): S | "possibly_incomplete";
