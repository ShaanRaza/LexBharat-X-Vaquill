import type { Template } from "./templates.mjs";
import type { PromptSource } from "../chat/prompt.mjs";
export const DRAFT_SYSTEM: string, PICK_SYSTEM: string;
export function buildSectionPrompt(o: { template: Template; section: { title: string; instruction: string }; values: Record<string, string>; extra?: string; sources: PromptSource[]; previous?: { title: string; text: string }[] }): { system: string; messages: { role: "user"; content: string }[] };
export function cleanSectionText(raw: string): string;
export function buildPickPrompt(templates: Template[], text: string): { system: string; messages: { role: "user"; content: string }[] };
export function parsePick(raw: string, templates: Template[]): { templateId: string; why: string; fit: "good" | "partial" | "poor" } | null;
