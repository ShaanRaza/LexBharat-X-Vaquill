// A live check of search by meaning for the selftest: ONE Voyage request, then every vector store (Acts, State, hand-filled, regulators, Supreme Court) must answer with hits for a vector of the size it expects.
// Throws with the reason when anything is off. Server-only. A one-off query text bypasses the query cache so Voyage really is asked.
import { embedQuery, EMBED_DIM, VOYAGE_MODEL } from "./embed";
import { regulatoryStore, scVectorStore, vectorStores } from "./vectorStore";

export async function probeMeaning(): Promise<string> {
  const stores = [...vectorStores(), regulatoryStore(), scVectorStore()].filter((x): x is NonNullable<typeof x> => !!x);
  if (!stores.length) throw new Error("no vector database is set up");
  const probe = `selftest punishment for theft ${Date.now()}`, out: string[] = [];
  for (const dim of new Set(stores.map((x) => x.dim))) {
    const v = await embedQuery(probe, dim);
    if (v.length !== dim) throw new Error(`the query vector has ${v.length} numbers, the store expects ${dim}`);
    for (const st of stores.filter((x) => x.dim === dim)) {
      const t = Date.now(), hits = await st.nearest(v, 3);
      if (!hits.length) throw new Error(`${st.corpus} (${st.backend}) returned no hits`);
      out.push(`${st.corpus} ${st.backend} ${dim}-d ${hits.length} hits ${Date.now() - t} ms`);
    }
  }
  return `${VOYAGE_MODEL} ${EMBED_DIM}-d query; ${out.join("; ")}`;
}
