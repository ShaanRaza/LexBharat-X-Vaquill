// GET /api/vault -> this browser's documents, the limits and what is used. POST /api/vault {name, size} -> checks the limits, makes the record and returns a short-lived URL the browser uploads the file to
// directly (so a 10 MB file never passes through this server); then the page calls /api/vault/<id>/process. Needs the access cookie and the anonymous browser id (set by the middleware).
import limitConfig from "@/config/vault-limits.json";
import { checkUpload, cleanName, readVaultLimits, storageName } from "@/lib/vault/files.mjs";
import { bidOf, envOf, json, NOT_SET_UP, vaultReady } from "@/lib/vault/http";
import { getFileStore } from "@/lib/vault/storage";
import { createDoc, deleteDoc, listDocs } from "@/lib/vault/store";

const limits = () => readVaultLimits(limitConfig, envOf());

export async function GET(req: Request) {
  const bid = bidOf(req); if (!bid) return json({ error: "No browser id." }, 400);
  const l = limits(), shown = { maxDocs: l.maxDocs, maxTotalMb: l.maxTotalMb, maxFileMb: l.maxFileMb };
  if (!vaultReady()) return json({ ready: false, docs: [], limits: shown, usedBytes: 0 });
  try { const docs = await listDocs(bid); return json({ ready: true, docs, limits: shown, usedBytes: docs.reduce((a, d) => a + d.sizeBytes, 0) }); }
  catch { return json({ ready: true, docs: [], limits: shown, usedBytes: 0, error: "Could not load your documents." }, 503); }
}

export async function POST(req: Request) {
  const bid = bidOf(req); if (!bid) return json({ error: "No browser id." }, 400);
  if (!vaultReady()) return json(NOT_SET_UP, 503);
  const body = (await req.json().catch(() => null)) as { name?: unknown; size?: unknown } | null;
  const name = typeof body?.name === "string" ? cleanName(body.name) : "", size = Number(body?.size);
  try {
    const existing = await listDocs(bid), v = checkUpload({ name, size }, existing, limits());
    if (!v.ok || !v.kind) return json({ error: v.message }, 422);
    const id = crypto.randomUUID(), key = `${bid}/${id}/${storageName(name)}`;
    await createDoc(bid, { id, name, kind: v.kind, sizeBytes: size, storageKey: key });
    try { const up = await getFileStore().signedUpload(key); return json({ id, uploadUrl: up.url }); }
    catch { await deleteDoc(bid, id).catch(() => null); return json({ error: "Could not prepare the upload. Please try again." }, 503); }
  } catch { return json({ error: "Could not start the upload. Please try again." }, 503); }
}
