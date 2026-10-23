// Server-only reader for the gzipped per-act section text built by scripts/acts/export-act-text.sh. The data lives OUTSIDE the repo; this module only
// reads it when ACTS_TEXT_DATA_DIR points at it. Without that variable (production today) every call answers { available: false } and nothing throws.
import { readFile } from "node:fs/promises";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import path from "node:path";
import type { AssembledSection } from "./reassemble.mjs";

const gunzipP = promisify(gunzip);

export type ActTextDoc = {
  schema: number; actId: string; title: string; jurisdiction: string; state: string | null; actStatus: string; year: number | null; sourceUrl: string | null;
  snapshot: string; licence: string; chunkCount: number; hasSectionNumbers: boolean; sections: AssembledSection[];
};
export type ActTextResult =
  | { available: true; doc: ActTextDoc }
  | { available: false; reason: "not_configured" | "not_in_export" | "unreadable"; message: string };

export const actsTextDir = (): string | null => process.env.ACTS_TEXT_DATA_DIR?.trim() || null;

const cache = new Map<string, ActTextDoc>();
const CACHE_MAX = 16;

export async function getActText(actId: string): Promise<ActTextResult> {
  const dir = actsTextDir();
  if (!dir) return { available: false, reason: "not_configured", message: "The text of this Act's sections is not published on this site yet." };
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(actId)) return { available: false, reason: "not_in_export", message: "This Act is not in the text export." };
  const hit = cache.get(actId);
  if (hit) return { available: true, doc: hit };
  try {
    const buf = await readFile(path.join(dir, `act=${actId}.json.gz`));
    const doc = JSON.parse((await gunzipP(buf)).toString("utf8")) as ActTextDoc;
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(actId, doc);
    return { available: true, doc };
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { available: false, reason: "not_in_export", message: "Section text for this entry is not included yet (regulator instruments are excluded, or the Act is not in the export)." };
    return { available: false, reason: "unreadable", message: "Section text could not be read. Please try again later." };
  }
}
