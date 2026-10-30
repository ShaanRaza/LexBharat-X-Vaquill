export function looksLikeContentsList(text: string | null | undefined): boolean;
export function headingIsContentsList(heading: string | null | undefined): boolean;
export function isContentsList(section?: { body?: string | null; heading?: string | null }): boolean;
export function effectiveStatus<S extends string>(status: S, section?: { body?: string | null; heading?: string | null }): S | "possibly_incomplete";
