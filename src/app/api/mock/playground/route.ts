// MOCK ENDPOINT: the API Playground backend. Takes {path, params}, returns a canned response plus fake
// request-id / latency / credit numbers. Latency is random; the request id is random; credits come from src/data/endpoints.ts.
import { endpoints } from "@/data/endpoints";
import { corpus, findByCite, search } from "@/data/corpus";

export async function POST(req: Request) {
  const { path, method, params } = (await req.json().catch(() => ({}))) as { path?: string; method?: string; params?: Record<string, string> };
  const ep = endpoints.find((e) => e.path === path && (!method || e.method === method));
  if (!ep) return Response.json({ _mock: true, error: "Unknown endpoint" }, { status: 400 });
  const p = params ?? {};
  let data: unknown;
  if (path?.endsWith("/resolve")) data = findByCite(p.cite ?? "") ?? { matched: false, hint: "Try 42 U.S.C. § 1983" };
  else if (path?.includes("/section/") || path?.endsWith("/sections")) data = corpus.find((s) => s.id === p.act_id) ?? corpus[0];
  else if (path?.endsWith("/search")) data = { total: search(p.query ?? "").length, results: search(p.query ?? "") };
  else if (path?.endsWith("/coverage") || path?.endsWith("/laws")) data = [{ jurisdiction: "Federal", corpora: ["US Code", "CFR"] }, { jurisdiction: "California", corpora: ["State statute"] }];
  else if (path?.endsWith("/divisions")) data = [{ level: "title", id: "42", label: "Title 42 (mock)" }];
  else if (path?.endsWith("/pricing")) data = { note: "mock", pro: "20,000 credits / month", business: "200,000 credits / month" };
  else data = { ok: true, note: "Canned response for this mock endpoint." };
  return Response.json({
    _mock: true,
    request_id: `req_${Math.random().toString(36).slice(2, 10)}`,
    latency_ms: 40 + Math.floor(Math.random() * 120),
    credits_used: ep.credits,
    data,
  });
}
