// MOCK ENDPOINT: local stand-in for `GET /api/playground/spec?jurisdiction=US` (shape CONFIRMED in docs/PLAYGROUND-TEARDOWN.md).
// Serves the fixture in src/data/playgroundSpec.ts. No upstream call.
import { SPEC_ENDPOINTS } from "@/data/playgroundSpec";

export function GET(req: Request) {
  const j = (new URL(req.url).searchParams.get("jurisdiction") ?? "US").toUpperCase();
  return Response.json({ endpoints: SPEC_ENDPOINTS.filter((e) => e.jurisdiction === j) }, { headers: { "x-brand": "vaquill", "x-robots-tag": "noindex, nofollow, noarchive, nosnippet" } });
}
