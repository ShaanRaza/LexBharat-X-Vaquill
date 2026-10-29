// GET /api/vault/search?q=..&exact=1 -> passages of THIS browser's own Vault documents that match: by meaning and exact words (default), or exact words only (exact=1, no embedding is made).
// Reuses the search Ask uses for attached documents (src/lib/vault/search.ts). Only this browser's documents are ever searched. Counts against the same per-minute search limit as the Acts search.
import { clientKey } from "@/lib/acts/semantic.mjs";
import { normalizeQuery } from "@/lib/acts/searchQuery.mjs";
import { rateCheck } from "@/lib/limits/counters";
import { bidOf, json, vaultReady } from "@/lib/vault/http";
import { searchAttached } from "@/lib/vault/search";
import { listDocs } from "@/lib/vault/store";

export async function GET(req: Request) {
  const bid = bidOf(req); if (!bid) return json({ error: "No browser id." }, 400);
  const p = new URL(req.url).searchParams, nq = normalizeQuery(p.get("q"));
  if (nq.q === undefined) return json({ error: nq.error }, 422);
  if (!vaultReady()) return json({ ready: false, docs: 0, passages: [] });
  const rl = await rateCheck("search", clientKey(req.headers), 30);
  if (!rl.ok) return json({ error: `Too many searches. Please wait ${rl.retryAfterSec} seconds and try again.` }, 429);
  try {
    const ready = (await listDocs(bid)).filter((d) => d.status === "ready");
    if (!ready.length) return json({ ready: true, docs: 0, passages: [], mode: "keywords" });
    const r = await searchAttached(bid, ready.map((d) => d.id), nq.q, 12, { keywordsOnly: p.get("exact") === "1" });
    return json({ ready: true, docs: ready.length, mode: r.mode, passages: r.passages.map((x) => ({ id: x.id, docId: x.docId, docName: x.docName, page: x.page, label: x.label, text: x.body.length > 420 ? `${x.body.slice(0, 420).replace(/\s+\S*$/, "")} …` : x.body, scan: !!x.scan, via: x.via })) });
  } catch { return json({ error: "Could not search your documents. Please try again." }, 503); }
}
