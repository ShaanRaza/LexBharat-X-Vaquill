// One request straight to Gemini for the self-test: no retries, no fallbacks, no streaming. Never throws; the key is never in the result. Server-only.
import config from "@/config/ai-models.json";
import { resolveTask } from "./models.mjs";

export type ProbeResult = { ok: boolean; status: number | null; ms: number; detail: string };
export async function openaiProbe(task: "review" | "chat" = "chat"): Promise<ProbeResult> {
  const env = process.env as Record<string, string | undefined>, key = (env.OPENAI_API_KEY ?? "").trim(), t = Date.now();
  if (!key) return { ok: false, status: null, ms: 0, detail: "OPENAI_API_KEY is not set" };
  if (!/^[\x21-\x7e]+$/.test(key)) return { ok: false, status: null, ms: 0, detail: `OPENAI_API_KEY holds a character a header cannot carry (length ${key.length})` };
  const spec = resolveTask(task, config, env).primary, model = spec.provider === "openai" ? spec.model : (config as { openaiProbeModel?: string }).openaiProbeModel ?? "";
  if (!model) return { ok: false, status: null, ms: 0, detail: "no OpenAI model is configured (set openaiProbeModel in ai-models.json)" };
  const reasoning = /^(o\d|gpt-5)/.test(model);
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(20000), body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with the single word: ok" }], ...(reasoning ? { max_completion_tokens: 64, reasoning_effort: /^gpt-5/.test(model) ? "minimal" : "low" } : { max_tokens: 8 }) }) });
    const body = await r.text().catch(() => ""), msg = (() => { try { return String(JSON.parse(body)?.error?.message ?? ""); } catch { return ""; } })();
    return { ok: r.ok, status: r.status, ms: Date.now() - t, detail: r.ok ? `model ${model} answered` : `model ${model}: ${msg.split(key).join("[key]").replace(/sk-[A-Za-z0-9_*-]+/g, "[key]").replace(/\s+/g, " ").slice(0, 160)}` };
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
