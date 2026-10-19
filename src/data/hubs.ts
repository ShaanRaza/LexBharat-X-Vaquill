// STATIC DATA: content hubs (blog, engineering, topics, clauses, playbooks).
// The full lists of titles/slugs live in hubs.generated.ts (one entry per public sitemap URL).
// Summaries below are generic placeholders written for this build; article bodies are not recreated.

import { blogItems, clausesItems, engineeringItems, topicsItems, playbooksItems, type GenItem } from "./hubs.generated";

export type Item = { slug: string; title: string; summary: string; category?: string };

const fill = (items: GenItem[], summary: (i: GenItem) => string): Item[] =>
  items.map((i) => ({ slug: i.slug, title: i.title, category: i.category, summary: i.summary ?? summary(i) }));

export const blog = fill(blogItems, () => "");
export const engineering = fill(engineeringItems, () => "");
export const topics = fill(topicsItems, () => "");
export const clauses = fill(clausesItems, (i) => `Recreated placeholder guide to the “${i.title}” clause: purpose, common language, fallbacks and red flags.`);
export const playbooks = fill(playbooksItems, (i) => `Recreated placeholder negotiation playbook for: ${i.title}.`);

export const hubs = { blog, engineering, topics, clauses, playbooks };
export type HubKey = keyof typeof hubs;

export const hubCounts = Object.fromEntries(Object.entries(hubs).map(([k, v]) => [k, v.length])) as Record<HubKey, number>;
