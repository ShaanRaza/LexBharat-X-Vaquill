import type { QfConfig } from "../quickfind/rank.mjs";
export const norm: (q: string) => string;
export type DeskKind = "empty" | "law" | "case" | "ask" | "search";
export function classifyDesk(q: string, cfg: QfConfig): { kind: DeskKind };
export function deskHint(kind: DeskKind, q: string, target: { title: string } | null, cfg: { emptyHint: string }): string;
