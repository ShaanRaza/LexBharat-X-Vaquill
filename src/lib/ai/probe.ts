// One request straight to Gemini for the self-test: no retries, no fallbacks, no streaming. Never throws; the key is never in the result. Server-only.
import config from "@/config/ai-models.json";
import { resolveTask } from "./models.mjs";

export type ProbeResult = { ok: boolean; status: number | null; ms: number; detail: string };
// One tiny request straight to an OpenAI-style provider (openrouter | openai), using its base URL and key name from ai-models.json. No retries, no fallback; the key never appears in the result. For OpenRouter the detail also says how much of the key's credit is left.
export async function chatProbe(provider: "openrouter" | "openai", task: "review" | "chat" = "chat"): Promise<ProbeResult> {
  const env = process.env as Record<string, string | undefined>, t = Date.now(), pc = ((config as unknown as { providers?: Record<string, { baseUrl?: string; keyEnv?: string; headers?: Record<string, string> }> }).providers ?? {})[provider] ?? {};
  const keyEnv = pc.keyEnv ?? `${provider.toUpperCase()}_API_KEY`, key = (env[keyEnv] ?? "").trim(), base = (pc.baseUrl ?? "").replace(/\/$/, "");
  if (!key) return { ok: false, status: null, ms: 0, detail: `${keyEnv} is not set` };
  if (!/^[\x21-\x7e]+$/.test(key)) return { ok: false, status: null, ms: 0, detail: `${keyEnv} holds a character a header cannot carry (length ${key.length})` };
  const spec = resolveTask(task, config, env).primary, model = spec.provider === provider ? spec.model : ((config as unknown as Record<string, string>)[`${provider}ProbeModel`] ?? "");
  if (!base || !model) return { ok: false, status: null, ms: 0, detail: `no ${provider} base URL or model is configured in ai-models.json` };
  const headers = { Authorization: `Bearer ${key}`, "content-type": "application/json", ...(pc.headers ?? {}) };
  try {
    const r = await fetch(`${base}/chat/completions`, { method: "POST", headers, cache: "no-store", signal: AbortSignal.timeout(20000), body: JSON.stringify({ model, max_tokens: 16, messages: [{ role: "user", content: "Reply with the single word: ok" }] }) });
    const body = await r.text().catch(() => ""), msg = (() => { try { return String(JSON.parse(body)?.error?.message ?? ""); } catch { return ""; } })();
    let credit = "";
    if (r.ok && provider === "openrouter") { const k = await fetch(`${base}/key`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(8000) }).then((x) => x.json()).catch(() => null); const d = k?.data; if (d && typeof d.limit_remaining === "number") credit = `; $${d.limit_remaining.toFixed(2)} of the $${d.limit} key limit left`; }
    return { ok: r.ok, status: r.status, ms: Date.now() - t, detail: r.ok ? `model ${model} answered${credit}` : `model ${model}: ${msg.split(key).join("[key]").replace(/sk-[A-Za-z0-9_*-]+/g, "[key]").replace(/\s+/g, " ").slice(0, 160)}` };
  } catch (e) { return { ok: false, status: null, ms: Date.now() - t, detail: `request did not complete (${(e as Error)?.name ?? "error"})` }; }
}

export async function geminiProbe(task: "review" | "chat" = "review"): Promise<ProbeResult> {
  const env = process.env as Record<string, string | undefined>, key = env.GEMINI_API_KEY ?? "", t = Date.now();
  if (!key.trim()) return { ok: false, status: null, ms: 0, detail: "GEMINI_API_KEY is not set" };
  if (!/^[\x21-\x7e]+$/.test(key.trim())) return { ok: false, status: null, ms: 0, detail: `GEMINI_API_KEY holds a character a header cannot carry (length ${key.length}, trimmed ${key.trim().length})` };
  const spec = resolveTask(task, config, env).primary; if (spec.provider !== "gemini") return { ok: false, status: null, ms: 0, detail: `the ${task} task uses ${spec.provider}, not Gemini` };
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(spec.model)}:generateContent`, { method: "POST", headers: { "x-goog-api-key": key.trim(), "content-type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(20000), body: JSON.stringify({ contents: [{ parts: [{ text: "Reply with the single word: ok" }] }], generationConfig: { maxOutputTokens: 8 } }) });
    const body = await r.text().catch(() => ""), msg = (() => { try { return String(JSON.parse(body)?.error?.message ?? ""); } catch { return ""; } })();
    return { ok: r.ok, status: r.status, ms: Date.now() - t, detail: r.ok ? `model ${spec.model} answered` : `model ${spec.model}: ${msg.replace(key.trim(), "[key]").replace(/\s+/g, " ").slice(0, 160)}` };
  } catch (e) { return { ok: false, status: null, ms: Date.now() - t, detail: `request did not complete (${(e as Error)?.name ?? "error"})` }; }
}
