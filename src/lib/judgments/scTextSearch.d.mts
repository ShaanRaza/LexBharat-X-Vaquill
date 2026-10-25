export function phraseIn(text: string, phrase: string): boolean;
export function termCounts(text: string, terms: string[]): { count: number; perTenK: number };
export function snippetAround(chunks: { i: number; ps?: number | null; t: string }[], terms: string[], open?: string, close?: string): { chunk: number; page: number | null; text: string };
