// Finds the passages of the attached documents that answer a question. LOGIC ONLY. Meaning search (Voyage query vector against the stored 256-d vectors) plus keyword ranking, merged; if the query
// vector cannot be made (Voyage busy) or a document has no vectors yet, keyword ranking alone is used. Only documents of this browser are ever searched.
import { embedQuery } from "@/lib/acts/embed";
import type { ChatSource } from "@/lib/chat/retrieve";
import { lexicalRank } from "./lexical.mjs";
import { chunksOf, getDocs, matchChunks, type Passage, type VaultDoc } from "./store";

export type DocPassage = Passage & { docName: string; via: "meaning" | "keywords" };

export async function searchAttached(bid: string, docIds: string[], question: string, k = 8): Promise<{ passages: DocPassage[]; docs: VaultDoc[]; mode: "meaning+keywords" | "keywords" }> {
  const docs = await getDocs(bid, docIds), ids = docs.map((d) => d.id);
  if (!ids.length) return { passages: [], docs, mode: "keywords" };
  const name = new Map(docs.map((d) => [d.id, d.name])), picked = new Map<string, DocPassage>();
  const put = (p: Passage, via: DocPassage["via"]) => { if (!picked.has(p.id)) picked.set(p.id, { ...p, docName: name.get(p.docId) ?? "document", via }); };
  let mode: "meaning+keywords" | "keywords" = "keywords";
  const allEmbedded = docs.every((d) => d.chunkCount > 0 && d.embeddedCount >= d.chunkCount);
  if (docs.some((d) => d.embeddedCount > 0)) {
    try { const v = await embedQuery(question); for (const m of (await matchChunks(bid, ids, v, 6)).filter((x) => x.similarity > 0.15)) put(m, "meaning"); mode = "meaning+keywords"; } catch { /* keyword ranking below */ }
  }
  const all = await chunksOf(bid, ids);
  for (const p of lexicalRank(question, all, mode === "meaning+keywords" && allEmbedded ? 3 : 6)) put(p, "keywords");
  const passages = [...picked.values()].slice(0, k).sort((a, b) => a.docId.localeCompare(b.docId) || a.idx - b.idx);
  return { passages, docs, mode };
}

/** The passages as chat sources numbered from 1, in the shape the chat prompt, citations and answer check already use. */
export function docChatSources(passages: DocPassage[]): ChatSource[] {
  return passages.map((p, i) => ({ n: i + 1, kind: "doc" as const, docId: p.docId, docName: p.docName, page: p.page, label: p.label, actId: "", sectionKey: "", actTitle: p.docName, year: null, category: "document", state: null, inForce: true, sourceUrl: null,
    number: null, heading: p.label, status: "ok", text: p.body, via: p.via }));
}
