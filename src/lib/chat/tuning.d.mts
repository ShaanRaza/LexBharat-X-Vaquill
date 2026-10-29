export type TuningFlags = { hybridSearch: boolean; statutoryRewrite: boolean; currentLaw: boolean; citationCheck: boolean };
export const FLAGS: Record<keyof TuningFlags, string>;
export function tuningFlags(cfg?: Partial<TuningFlags>, env?: Record<string, string | undefined>): TuningFlags;
