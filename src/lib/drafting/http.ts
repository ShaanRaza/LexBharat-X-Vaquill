// Small helpers shared by the drafting API routes. Server-only.
import { isBrowserId } from "@/lib/access/token.mjs";

export const bidOf = (req: Request): string | null => { const b = req.headers.get("x-lb-bid"); return isBrowserId(b) ? b : null; };
export const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });
export const envOf = () => process.env as Record<string, string | undefined>;
