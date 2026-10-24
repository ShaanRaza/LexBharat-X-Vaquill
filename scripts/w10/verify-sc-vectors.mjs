// W10 item 10 check: are the Supreme Court vectors in Qdrant (legal_corpus_v2) voyage-4? Embeds 3 stored chunk texts with voyage-4 (normal API, 1024-d) and compares with the stored vectors.
import { env } from "../acts/bakeoff-lib.mjs";
const QD = "http://localhost:6333";
const r = await (await fetch(`${QD}/collections/legal_corpus_v2/points/scroll`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ limit: 3, with_payload: ["text", "chunk_id"], with_vector: ["dense"], filter: { must: [{ key: "court_type", match: { value: "supreme_court" } }] } }) })).json();
const pts = r.result.points;
for (const model of (process.argv[2] ?? "voyage-4").split(",")) {
  const v = await (await fetch("https://api.voyageai.com/v1/embeddings", { method: "POST", headers: { Authorization: `Bearer ${env.VOYAGE_API_KEY.trim()}`, "content-type": "application/json" }, body: JSON.stringify({ input: pts.map((p) => p.payload.text), model, input_type: "document", output_dimension: 1024 }) })).json();
  if (!v.data) { console.log(model, "error", v.detail ?? JSON.stringify(v).slice(0, 120)); continue; }
  const cos = (a, b) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return d / Math.sqrt(na * nb); };
  console.log(model, pts.map((p, i) => `${p.payload.chunk_id}: cos=${cos(p.vector.dense ?? p.vector, v.data[i].embedding).toFixed(4)}`).join(" | "));
}
