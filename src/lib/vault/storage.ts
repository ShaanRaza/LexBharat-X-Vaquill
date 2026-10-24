// File storage behind one interface, so the Supabase bucket can be replaced by Cloudflare R2 (or any S3-like store) by config: set VAULT_STORAGE=r2 once an R2 implementation of FileStore exists
// (see docs/VAULT.md, "Moving to R2"). Nothing outside this file knows which store is in use. Keys look like "<browser id>/<document id>/<file name>".
import { readVaultLimits } from "./files.mjs";
import limitConfig from "@/config/vault-limits.json";
import { sb } from "./supabase";

export interface FileStore {
  readonly name: string;
  /** A short-lived URL the BROWSER can upload one file to (so large files never pass through our server). */
  signedUpload(key: string): Promise<{ url: string }>;
  get(key: string): Promise<Uint8Array | null>;
  remove(keys: string[]): Promise<void>;
  /** Size in bytes of a stored object, or null if it is not there. */
  size(key: string): Promise<number | null>;
  /** A short-lived download link. `filename` is what the browser saves it as. */
  signedDownload(key: string, seconds: number, filename: string): Promise<string>;
  /** Total objects and bytes held (for the size report). */
  usage(): Promise<{ objects: number; bytes: number }>;
}

const bucketName = () => readVaultLimits(limitConfig, process.env as Record<string, string | undefined>).bucket;

class SupabaseStore implements FileStore {
  readonly name = "supabase";
  private b() { return sb().storage.from(bucketName()); }
  async signedUpload(key: string) { const { data, error } = await this.b().createSignedUploadUrl(key); if (error || !data) throw new Error("could not prepare the upload"); return { url: data.signedUrl }; }
  async get(key: string) { const { data, error } = await this.b().download(key); if (error || !data) return null; return new Uint8Array(await data.arrayBuffer()); }
  async remove(keys: string[]) { if (!keys.length) return; const { error } = await this.b().remove(keys); if (error) throw new Error("could not delete the file"); }
  async size(key: string) {
    const i = key.lastIndexOf("/"), { data, error } = await this.b().list(key.slice(0, i), { search: key.slice(i + 1), limit: 5 });
    if (error) return null;
    const f = (data ?? []).find((o) => o.name === key.slice(i + 1));
    return f ? Number((f.metadata as { size?: number } | null)?.size ?? 0) : null;
  }
  async signedDownload(key: string, seconds: number, filename: string) { const { data, error } = await this.b().createSignedUrl(key, seconds, { download: filename }); if (error || !data) throw new Error("could not create the link"); return data.signedUrl; }
  async usage() {
    let objects = 0, bytes = 0;
    const walk = async (prefix: string): Promise<void> => {
      const { data } = await this.b().list(prefix, { limit: 1000 });
      for (const o of data ?? []) { if (o.id === null) await walk(prefix ? `${prefix}/${o.name}` : o.name); else { objects++; bytes += Number((o.metadata as { size?: number } | null)?.size ?? 0); } }
    };
    await walk("");
    return { objects, bytes };
  }
}

export function getFileStore(): FileStore {
  const which = (process.env.VAULT_STORAGE ?? "supabase").toLowerCase();
  if (which === "supabase") return new SupabaseStore();
  throw new Error(`VAULT_STORAGE=${which} is not implemented yet (see docs/VAULT.md)`);
}
