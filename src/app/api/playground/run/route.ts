// MOCK ENDPOINT: local stand-in for `POST /api/playground/run` ({ endpointId, values, apiKey } -> { status, ok, body, meta }).
// The request/response shape is CONFIRMED in docs/PLAYGROUND-TEARDOWN.md. It always answers HTTP 200 with the upstream status inside the
// envelope. A short artificial delay (INFERRED, 300-900 ms; the live Pricing call took 0.3-0.85 s) lets the Cancel button and timer show.
import { runMock, type RunValues } from "@/lib/playgroundMock";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { endpointId?: string; values?: RunValues; apiKey?: string | null };
  const t0 = Date.now();
  await new Promise((r) => setTimeout(r, 350 + Math.random() * 450));
  const env = runMock(String(b.endpointId ?? ""), b.values ?? {}, b.apiKey ?? null);
  if (env.meta.requestId) env.meta.elapsedMs = Date.now() - t0;
  return Response.json(env, { headers: { "x-brand": "vaquill", "x-robots-tag": "noindex, nofollow, noarchive, nosnippet" } });
}
