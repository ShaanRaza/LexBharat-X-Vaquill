// GET /api/vault/<id>/download -> { url }: a link that works for a short time (seconds set in src/config/vault-limits.json) and saves the file under its current name. Only for this browser's documents.
import limitConfig from "@/config/vault-limits.json";
import { readVaultLimits } from "@/lib/vault/files.mjs";
import { bidOf, envOf, json, vaultReady } from "@/lib/vault/http";
import { getFileStore } from "@/lib/vault/storage";
import { getDoc } from "@/lib/vault/store";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params, bid = bidOf(req); if (!bid || !vaultReady()) return json({ error: "Document not found." }, 404);
  try {
    const d = await getDoc(bid, id); if (!d) return json({ error: "Document not found." }, 404);
    const secs = readVaultLimits(limitConfig, envOf()).signedUrlSeconds, name = d.name.toLowerCase().endsWith(`.${d.kind}`) ? d.name : `${d.name}.${d.kind}`;
    return json({ url: await getFileStore().signedDownload(d.storageKey, secs, name), expiresInSeconds: secs });
  } catch { return json({ error: "Could not create the download link." }, 503); }
}
