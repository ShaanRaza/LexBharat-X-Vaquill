// Word matching shared by the Supreme Court cross-year search (scSearch.ts) and the in-year search (jsonStore.ts), so a query means the same thing on both:
// every word of the query must start a word of the case's title, citation, parties or extracted case number ("5491/2024" is the words 5491 and 2024). Not judgment text.
// Accents are folded ("ñandú" is "nandu", as in the High Court tokenizer), so a letter with an accent never splits a word in two.
export const normScText = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Query words. "v", "vs" and "versus" only join parties and are ignored unless they are all the user typed. A query with no letters or digits gives no words. */
export function queryWords(query: string): string[] {
  const all = normScText(query).split(" ").filter(Boolean), words = all.filter((t) => !["v", "vs", "versus"].includes(t));
  return words.length ? words : all;
}
/** `hay` is " " + normalised text + " " (see hayOf). An empty word list matches nothing. */
export const matchesWords = (hay: string, words: string[]) => words.length > 0 && words.every((t) => hay.includes(` ${t}`));
export const hayOf = (...parts: (string | undefined | null)[]) => ` ${normScText(parts.filter(Boolean).join(" "))} `;
