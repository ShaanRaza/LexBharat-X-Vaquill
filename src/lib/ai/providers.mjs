// Provider adapters: one function per provider, same input and output. PURE of app state: `fetchImpl` and the key come in as arguments (tests pass fakes).
//   stream({ spec:{provider,model}, system, messages:[{role:"user"|"assistant",content}], temperature, maxOutputTokens, thinking, json, timeoutMs, signal, env, fetchImpl })
//   -> async generator of { type:"text", text } ... then { type:"done", usage:{inputTokens, outputTokens} }. Throws AiError.
// Keys come from `env` and are only ever put in a request header, never in a URL or a message.
import { AiError } from "./models.mjs";
import { sseEvents } from "./sse.mjs";

const signalFor = (timeoutMs, signal) => (signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs));
const scrub = (s, env) => { let t = String(s ?? "").slice(0, 400); for (const k of ["GEMINI_API_KEY", "ANTHROPIC_API_KEY", "LITELLM_API_KEY"]) if (env[k]) t = t.split(env[k]).join("<key>"); return t; };

async function post(url, headers, body, { timeoutMs, signal, fetchImpl = fetch, env }) {
  let res;
  try { res = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: signalFor(timeoutMs, signal), cache: "no-store" }); }
  catch (e) { throw new AiError(e?.name === "TimeoutError" || e?.name === "AbortError" ? "timeout" : "unavailable", e?.name === "TimeoutError" ? "The model took too long to answer." : "The model could not be reached."); }
  if (res.ok) return res;
  const text = scrub(await res.text().catch(() => ""), env);
  if (res.status === 429) { const m = /retry in ([\d.]+)s|"retryDelay":\s*"(\d+)s"/i.exec(text); throw new AiError("rate_limit", "The model is busy.", { status: 429, retryAfterSec: m ? Math.ceil(Number(m[1] ?? m[2])) : undefined, detail: text }); }
  if (res.status === 401 || res.status === 403 || /API_KEY_INVALID|API key not valid|authentication/i.test(text)) throw new AiError("auth", "The model key was rejected.", { status: res.status });
  if (res.status >= 500) throw new AiError("unavailable", "The model is unavailable right now.", { status: res.status });
  throw new AiError("bad_request", `The model rejected the request (${res.status}).`, { status: res.status, detail: text });
}

// ---------------- Gemini (Google AI Studio / Gemini API)
export async function* streamGemini(o) {
  const key = o.env.GEMINI_API_KEY?.trim();
  if (!key) throw new AiError("not_configured", "GEMINI_API_KEY is not set.");
  const gen = { temperature: o.temperature, maxOutputTokens: o.maxOutputTokens };
  if (o.json) gen.responseMimeType = "application/json";
  // thinking: Gemini 3 takes a level, Gemini 2.5 takes a token budget (0 = off)
  // (gemini-3.8-flash does not accept "minimal": its lowest level is "low")
  if (/^gemini-3/.test(o.spec.model)) gen.thinkingConfig = { thinkingLevel: o.thinking === "off" || o.thinking === "minimal" ? (/^gemini-3\.8/.test(o.spec.model) ? "low" : "minimal") : o.thinking };
  else if (/^gemini-2\.5-(flash|flash-lite)$/.test(o.spec.model)) gen.thinkingConfig = { thinkingBudget: ({ off: 0, minimal: 0, low: 512, medium: 2048, high: 8192 })[o.thinking] ?? 0 };
  const res = await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(o.spec.model)}:streamGenerateContent?alt=sse`, { "x-goog-api-key": key },
    { systemInstruction: o.system ? { parts: [{ text: o.system }] } : undefined, contents: o.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })), generationConfig: gen }, o);
  let usage = { inputTokens: 0, outputTokens: 0 }, finish = null;
  for await (const ev of sseEvents(res.body)) {
    let j; try { j = JSON.parse(ev.data); } catch { continue; }
    if (j.error) throw new AiError(j.error.code === 429 ? "rate_limit" : "unavailable", "The model is busy.", { detail: scrub(j.error.message, o.env) });
    if (j.promptFeedback?.blockReason) throw new AiError("blocked", "The model declined to answer this.");
    for (const p of j.candidates?.[0]?.content?.parts ?? []) if (p.text && !p.thought) yield { type: "text", text: p.text };
    finish = j.candidates?.[0]?.finishReason ?? finish;
    if (j.usageMetadata) usage = { inputTokens: j.usageMetadata.promptTokenCount ?? 0, outputTokens: (j.usageMetadata.candidatesTokenCount ?? 0) + (j.usageMetadata.thoughtsTokenCount ?? 0) };
  }
  if (finish === "SAFETY" || finish === "PROHIBITED_CONTENT") throw new AiError("blocked", "The model declined to answer this.");
  yield { type: "done", usage, finish };
}

// ---------------- Anthropic (Claude)
export async function* streamAnthropic(o) {
  const key = o.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new AiError("not_configured", "ANTHROPIC_API_KEY is not set.");
  const res = await post("https://api.anthropic.com/v1/messages", { "x-api-key": key, "anthropic-version": "2023-06-01" },
    { model: o.spec.model, max_tokens: o.maxOutputTokens, temperature: o.temperature, system: o.system || undefined, messages: o.messages.map((m) => ({ role: m.role, content: m.content })), stream: true }, o);
  let usage = { inputTokens: 0, outputTokens: 0 }, finish = null;
  for await (const ev of sseEvents(res.body)) {
    let j; try { j = JSON.parse(ev.data); } catch { continue; }
    if (j.type === "error") throw new AiError(j.error?.type === "overloaded_error" ? "unavailable" : j.error?.type === "rate_limit_error" ? "rate_limit" : "bad_request", "The model could not answer.", { detail: scrub(j.error?.message, o.env) });
    if (j.type === "message_start") usage.inputTokens = j.message?.usage?.input_tokens ?? 0;
    if (j.type === "content_block_delta" && j.delta?.type === "text_delta" && j.delta.text) yield { type: "text", text: j.delta.text };
    if (j.type === "message_delta") { usage.outputTokens = j.usage?.output_tokens ?? usage.outputTokens; finish = j.delta?.stop_reason ?? finish; }
  }
  yield { type: "done", usage, finish };
}

// ---------------- LiteLLM / any OpenAI-compatible endpoint (LITELLM_BASE_URL + LITELLM_API_KEY)
export async function* streamOpenAiCompat(o) {
  const key = o.env.LITELLM_API_KEY?.trim(), base = o.env.LITELLM_BASE_URL?.trim().replace(/\/$/, "");
  if (!key || !base) throw new AiError("not_configured", "LITELLM_BASE_URL and LITELLM_API_KEY are not set.");
  const res = await post(`${base}/chat/completions`, { Authorization: `Bearer ${key}` },
    { model: o.spec.model, temperature: o.temperature, max_tokens: o.maxOutputTokens, stream: true, stream_options: { include_usage: true }, ...(o.json ? { response_format: { type: "json_object" } } : {}),
      messages: [...(o.system ? [{ role: "system", content: o.system }] : []), ...o.messages.map((m) => ({ role: m.role, content: m.content }))] }, o);
  let usage = { inputTokens: 0, outputTokens: 0 }, finish = null;
  for await (const ev of sseEvents(res.body)) {
    if (ev.data === "[DONE]") break;
    let j; try { j = JSON.parse(ev.data); } catch { continue; }
    if (j.error) throw new AiError("unavailable", "The model could not answer.", { detail: scrub(j.error.message, o.env) });
    const c = j.choices?.[0]; if (c?.delta?.content) yield { type: "text", text: c.delta.content };
    finish = c?.finish_reason ?? finish;
    if (j.usage) usage = { inputTokens: j.usage.prompt_tokens ?? 0, outputTokens: j.usage.completion_tokens ?? 0 };
  }
  yield { type: "done", usage, finish };
}

export const STREAMERS = { gemini: streamGemini, anthropic: streamAnthropic, litellm: streamOpenAiCompat };
