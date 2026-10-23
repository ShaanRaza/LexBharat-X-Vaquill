// Runs a task through its configured model, with fallbacks. PURE of app state (config, env and fetch are arguments).
import { AiError, isRetryable, providerConfigured, resolveTask } from "./models.mjs";
import { STREAMERS } from "./providers.mjs";

// A model that has produced no text within `firstTokenMs` is given up on (treated as a timeout), so a slow model falls back to the next one instead of leaving the user waiting.
const asAiError = (e) => (e instanceof AiError ? e : e?.name === "AbortError" || e?.name === "TimeoutError" ? new AiError("timeout", "The model took too long to answer.") : e);

/** Streams a task: yields { type:"text", text } then { type:"done", usage, model }. If the first model fails BEFORE any text, the next fallback is tried; after text has been sent the error is thrown. */
export async function* streamTask(task, input, { config, env, fetchImpl }) {
  const t = resolveTask(task, config, env), chain = [t.primary, ...t.fallbacks];
  let lastErr = null;
  for (const spec of chain) {
    if (!providerConfigured(spec.provider, env)) { lastErr = new AiError("not_configured", `${spec.provider} is not set up.`); continue; }
    let started = false;
    const ac = new AbortController(), ttft = input.firstTokenMs ?? t.firstTokenMs;
    const onCaller = () => ac.abort(); input.signal?.addEventListener("abort", onCaller);
    let timer = ttft ? setTimeout(() => ac.abort(), ttft) : null;
    try {
      for await (const ev of STREAMERS[spec.provider]({ spec, system: input.system, messages: input.messages, temperature: input.temperature ?? t.temperature, maxOutputTokens: input.maxOutputTokens ?? t.maxOutputTokens,
        thinking: t.thinking, json: input.json ?? t.json, timeoutMs: input.timeoutMs ?? t.timeoutMs, signal: ac.signal, env, fetchImpl })) {
        if (ev.type === "text") { started = true; if (timer) { clearTimeout(timer); timer = null; } }
        yield ev.type === "done" ? { ...ev, model: `${spec.provider}:${spec.model}` } : ev;
      }
      return;
    } catch (e) {
      lastErr = asAiError(e);
      if (started || !isRetryable(lastErr)) throw lastErr;
    } finally { if (timer) clearTimeout(timer); input.signal?.removeEventListener("abort", onCaller); }
  }
  throw lastErr ?? new AiError("not_configured", "No model is configured for this task.");
}

/** Collects a whole answer: { text, usage, model }. */
export async function completeTask(task, input, ctx) {
  let text = "", usage = null, model = null;
  for await (const ev of streamTask(task, input, ctx)) { if (ev.type === "text") text += ev.text; else if (ev.type === "done") { usage = ev.usage; model = ev.model; } }
  return { text, usage, model };
}
