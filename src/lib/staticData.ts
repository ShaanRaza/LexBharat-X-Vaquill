// Reads the large static data files (public/data, copied by scripts/copy-static-data.mjs) from the site's own CDN at run time, so they are NOT part of any server function.
// The address comes from the incoming request (works on localhost with any port, on preview and on production). Parsed files are kept in memory for the life of the
// server instance. Server-only, and only usable while a request is being handled.
import { headers } from "next/headers";

const cache = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 24;

export async function staticJson<T>(rel: string): Promise<T> {
  const hit = cache.get(rel);
  if (hit) return hit as Promise<T>;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) throw new Error("no host");
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.|\[::1\])/.test(host) ? "http" : "https");
  const p = fetch(`${proto}://${host}/data/${rel}`, { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error(`static data ${rel}: ${r.status}`); return r.json(); });
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(rel, p);
  p.catch(() => cache.delete(rel));
  return p as Promise<T>;
}
