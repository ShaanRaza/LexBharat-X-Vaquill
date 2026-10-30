export type LawKey = "ipc" | "crpc" | "evidence" | "bns" | "bnss" | "bsa";
export interface MappingRow { old_law: LawKey; old_section: string; old_title: string; new_law: LawKey; new_section: string; new_title: string; status: "verified" | "unverified"; source: string; what_changed?: string; old_in_data?: boolean; new_in_data?: boolean }
export interface MappingLaw { label: string; name: string; actId: string; kind: "old" | "new"; replacedBy?: LawKey; replaces?: LawKey; status: "verified" | "unverified"; source: string }
export interface MappingData { inForceFrom: string; laws: Record<LawKey, MappingLaw>; rows: MappingRow[] }
export const UNVERIFIED_LABEL: string;
export const PAIRS: [LawKey, LawKey][];
export function baseNumber(s: string): string;
export function presentation(row: Pick<MappingRow, "status"> & { what_changed?: string }): { fact: boolean; label: string | null; whatChanged: string | null };
export function rowsFor(data: MappingData, oldLaw: LawKey): MappingRow[];
export function rowLinks(row: MappingRow, data: MappingData): { old: string | null; new: string | null };
export function lookup(data: MappingData, raw: string): { kind: "old" | "new" | "any"; law: LawKey | null; number: string; rows: MappingRow[] } | null;
