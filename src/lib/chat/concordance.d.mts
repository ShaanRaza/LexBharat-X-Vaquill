export interface Counterpart { law: string; side: "old" | "new"; short: string; lookup: string; name: string; number: string; title: string | null; textInData: boolean; selfTextInData?: boolean }
export interface Pair { self: { law: string; side: "old" | "new"; short: string; name: string; number: string; title: string | null; n?: number; textInData: boolean }; partner: Counterpart }
export const EFFECTIVE: string;
export function actSide(title: string): { law: string; side: "old" | "new" } | null;
export function counterparts(s: { actTitle: string; number: string | number | null }): Counterpart[];
export function counterpartsOfShort(short: string, number: string): Counterpart[];
export const lookupFor: (p: Counterpart) => string;
export function pairsOf(sources: { kind?: string; actTitle: string; number: string | null; heading?: string | null; n?: number }[]): Pair[];
export function mappingNote(pairs: Pair[]): string | null;
export const MAPPING_ADDENDUM: (note: string) => string;
export function mentions(text: string, p: Counterpart): boolean;
export function missingMentions(answer: string, pairs: Pair[], citeOf?: (p: Counterpart) => string): { partner: Counterpart; partners: Counterpart[]; line: string }[];
export function usableTitle(t: string | null | undefined): string | null;
export function counterpartsOfLookup(lookup: string): Counterpart[];
export function pairsOfNamed(lookups: string[], have?: Set<string>): Pair[];
export function lookupLaw(lookup: string): { law: string; number: string } | null;
export function citeFinder(sources: { kind?: string; actTitle: string; number: string | null; n?: number }[]): (p: Counterpart) => string;
export const actIdFor: (law: string) => string | null;
