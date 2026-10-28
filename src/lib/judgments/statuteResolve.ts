// Turns the mentions found in a judgment's text (statuteLinks.mjs) into links to our Act pages. A mention is linked only when the Act is one of ours AND the section/unit exists in our data
// (or is known to be missing from the source data, which has its own page). Anything else stays plain text.
import acts from "@/config/statute-acts.json";
import { query, dbConfigured } from "@/lib/acts/db";
import { findMentions, mentionLabel, type Mention } from "./statuteLinks.mjs";

export type LinkState = "found" | "missing" | "none";
export type Resolved = Mention & { label: string; href: string | null; state: LinkState; actId: string | null };
const actIdOf = (key: string) => ((acts as Record<string, string | null>)[key] ?? null);
const keyOf = (m: Mention) => `${m.actKey}|${m.number}`;

/** Mentions in `text` with a link where one is certain. `judgmentYear` settles Acts whose name was used for older Acts too. */
export async function resolveMentions(text: string, judgmentYear: number | null): Promise<Resolved[]> {
  const mentions = findMentions(text, judgmentYear);
  const wanted = new Map<string, Set<string>>();   // actId -> numbers
  for (const m of mentions) { const id = actIdOf(m.actKey); if (id) (wanted.get(id) ?? wanted.set(id, new Set()).get(id)!).add(m.number); }
  const found = new Map<string, string>(), missing = new Set<string>();   // "actId|NUMBER" -> section key / known-missing
  if (dbConfigured() && wanted.size) {
    await Promise.all([...wanted].map(async ([id, nums]) => {
      const rows = await query<{ number: string; sectionKey: string }>(`SELECT number, section_key AS "sectionKey" FROM act_sections_v WHERE act_id = $1 AND upper(number) = ANY($2::text[])`, [id, [...nums]]).catch(() => []);
      for (const r of rows) found.set(`${id}|${r.number.toUpperCase()}`, r.sectionKey);
      const plain = [...nums].filter((n) => /^\d{1,4}$/.test(n)).map(Number);
      if (plain.length) for (const r of await query<{ number: number }>(`SELECT m.number FROM act_missing_sections m WHERE m.act_id = $1 AND m.number = ANY($2::int[]) AND NOT EXISTS (SELECT 1 FROM act_sections_supplement x WHERE x.act_id = m.act_id AND x.number = m.number::text)`, [id, plain]).catch(() => [])) missing.add(`${id}|${r.number}`);
    }));
  }
  return mentions.map((m) => {
    const id = actIdOf(m.actKey), label = mentionLabel(m), k = id ? `${id}|${m.number}` : "";
    if (id && found.has(k)) return { ...m, label, actId: id, state: "found", href: `/law/${id}?section=${encodeURIComponent(found.get(k)!)}` };
    if (id && missing.has(k)) return { ...m, label, actId: id, state: "missing", href: `/law/${id}/m${m.number}` };
    return { ...m, label, actId: id, state: "none", href: null };
  });
}

/** "Laws referred to": one entry per Act, with its distinct sections/units in the order first mentioned. */
export function lawsReferred(rs: Resolved[]) {
  const by = new Map<string, { actKey: string; actName: string; items: Resolved[] }>();
  for (const m of rs) {
    const e = by.get(m.actKey) ?? by.set(m.actKey, { actKey: m.actKey, actName: m.actName, items: [] }).get(m.actKey)!;
    if (!e.items.some((x) => keyOf(x) === keyOf(m))) e.items.push(m);
  }
  return [...by.values()];
}
