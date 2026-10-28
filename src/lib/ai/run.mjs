// Runs a task through its configured model, with fallbacks. PURE of app state (config, env and fetch are arguments).
import { AiError, isRetryable, providerConfigured, resolveTask } from "./models.mjs";
import { STREAMERS } from "./providers.mjs";
import { creditStatus } from "./guard.mjs";

// A model that has produced no text within `firstTokenMs` is given up on (treated as a timeout), so a slow model falls back to the next one instead of leaving the user waiting.
const asAiError = (e) => (e instanceof AiError ? e : e?.name === "AbortError" || e?.name === "TimeoutError" ? new AiError("timeout", "The model took too long to answer.") : e);

// A task can have a total time budget (`budgetMs`): every attempt, the wait before a retry and every fallback come out of it, so a slow model plus a fallback can never run past the host's request limit. Fewer than this many ms left: no new attempt.
const MIN_ATTEMPT_MS = 2000;
const pause = (ms, signal) => new Promise((res) => { const id = setTimeout(res, ms); signal?.addEventListener("abort", () => { clearTimeout(id); res(); }, { once: true }); });

/** Streams a task: yields { type:"text", text } then { type:"done", usage, model }. If the first model fails BEFORE any text, the next fallback is tried; after text has been sent the error is thrown. */
export async function* streamTask(task, input, { config, env, fetchImpl }) {
  const t = resolveTask(task, config, env), chain = [t.primary, ...t.fallbacks], began = Date.now(), left = () => (t.budgetMs ? t.budgetMs - (Date.now() - began) : Infinity);
  let lastErr = null, guard = null;
  for (const spec of chain) {
    if (!providerConfigured(spec.provider, env, config.providers?.[spec.provider])) { lastErr = new AiError("not_configured", `${spec.provider} is not set up.`); continue; }
    // spend guard: a paid provider whose key is nearly out of credit is skipped, so the task goes to the next (free) model
    if (config.spendGuard?.provider === spec.provider && spec !== chain[chain.length - 1]) { guard ??= await creditStatus({ config, env, fetchImpl }); if (guard.tripped) { lastErr = new AiError("not_configured", "The paid model is paused to protect the monthly budget."); continue; } }
    for (let attempt = 0; ; attempt++) {
    if (left() < MIN_ATTEMPT_MS) { if (lastErr) throw lastErr; }   // out of time: report the last real error
    let started = false;
    // the first-token deadline applies only while there is another model to fall back to; the last one in the chain is given its full timeout
    const ac = new AbortController(), ttft = spec === chain[chain.length - 1] ? 0 : Math.min(input.firstTokenMs ?? t.firstTokenMs, left());
    const onCaller = () => ac.abort(); input.signal?.addEventListener("abort", onCaller);
    let timer = ttft ? setTimeout(() => ac.abort(), ttft) : null;
    try {
      for await (const ev of STREAMERS[spec.provider]({ spec, providerCfg: config.providers?.[spec.provider], system: input.system, messages: input.messages, temperature: input.temperature ?? t.temperature, maxOutputTokens: input.maxOutputTokens ?? t.maxOutputTokens,
        thinking: t.thinking, json: input.json ?? t.json, timeoutMs: Math.min(input.timeoutMs ?? t.timeoutMs, left()), signal: ac.signal, env, fetchImpl })) {
        if (ev.type === "text") { started = true; if (timer) { clearTimeout(timer); timer = null; } }
        yield ev.type === "done" ? { ...ev, model: `${spec.provider}:${spec.model}` } : ev;
      }
      return;
    } catch (e) {
      lastErr = asAiError(e);
      if (started || !isRetryable(lastErr)) throw lastErr;
      // "unavailable" (a 503 or no answer) is often over in seconds: wait, then ask the same model again before using the fallback (rule in ai-models.json)
      if (lastErr instanceof AiError && lastErr.kind === "unavailable" && attempt < t.retryUnavailable.times && !input.signal?.aborted) { await pause(t.retryUnavailable.waitMs, input.signal); continue; }
    } finally { if (timer) clearTimeout(timer); input.signal?.removeEventListener("abort", onCaller); }
    break;
    }
  }
  throw lastErr ?? new AiError("not_configured", "No model is configured for this task.");
}

/** Collects a whole answer: { text, usage, model }. */
export async function completeTask(task, input, ctx) {
  let text = "", usage = null, model = null;
  for await (const ev of streamTask(task, input, ctx)) { if (ev.type === "text") text += ev.text; else if (ev.type === "done") { usage = ev.usage; model = ev.model; } }
  return { text, usage, model };
}
