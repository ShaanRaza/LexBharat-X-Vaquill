// Model per task: reads src/config/ai-models.json plus AI_MODEL_<TASK> overrides. PURE (no network). A spec is "provider:model", e.g. "gemini:gemini-3.5-flash-lite" or "anthropic:claude-haiku-5-5" or "openai:<model>".
export const PROVIDERS = ["gemini", "openai", "openrouter", "anthropic", "litellm"];

export function parseModelSpec(spec) {
  const m = /^([a-z]+):(.+)$/.exec(String(spec ?? "").trim());
  if (!m || !PROVIDERS.includes(m[1])) throw new Error(`Bad model spec "${spec}": use provider:model with provider one of ${PROVIDERS.join(", ")}.`);
  return { provider: m[1], model: m[2].trim() };
}

const envName = (task) => `AI_MODEL_${task.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}`;

const fallbackEnvName = (task) => `AI_FALLBACK_${task.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}`;

/** { task, primary: {provider, model}, fallbacks: [...], thinking, temperature, maxOutputTokens, timeoutMs, json } for a task; the env var overrides the configured model. */
// Fallbacks: AI_FALLBACK_<TASK> (comma-separated specs; set but empty = none) overrides the configured list.
function fallbackSpecs(task, t, env) {
  const v = env[fallbackEnvName(task)];
  return (v === undefined ? (t.fallback ?? []) : v.split(",").map((x) => x.trim()).filter(Boolean)).map(parseModelSpec);
}

/** { times, waitMs } for asking the same model again after "unavailable"; no rule (or times 0) means move straight to the fallback. */
const retryRule = (r) => ({ times: Math.max(0, Math.min(3, Math.floor(Number(r?.times) || 0))), waitMs: Math.max(0, Math.min(15000, Number(r?.waitMs) || 0)) });
export function resolveTask(task, config, env = {}) {
  const t = config.tasks?.[task];
  if (!t) throw new Error(`Unknown AI task "${task}".`);
  const spec = env[envName(task)]?.trim() || t.model;
  return {
    task, primary: parseModelSpec(spec), fallbacks: fallbackSpecs(task, t, env), retryUnavailable: retryRule(t.retryUnavailable ?? config.retry?.unavailable),
    thinking: t.thinking ?? "off", temperature: t.temperature ?? 0.2, maxOutputTokens: t.maxOutputTokens ?? 1500, timeoutMs: t.timeoutMs ?? 60000, firstTokenMs: t.firstTokenMs ?? 0, budgetMs: Number(t.budgetMs) > 0 ? Number(t.budgetMs) : 0, json: !!t.json,
  };
}

/** The environment variable that must be set for a provider. */
export const providerKeyName = (provider) => ({ gemini: "GEMINI_API_KEY", openai: "OPENAI_API_KEY", openrouter: "OPENROUTER_API_KEY", anthropic: "ANTHROPIC_API_KEY", litellm: "LITELLM_API_KEY" })[provider];
export const providerConfigured = (provider, env, providerCfg) => !!env[providerCfg?.keyEnv ?? providerKeyName(provider)]?.trim() && (provider !== "litellm" || !!env.LITELLM_BASE_URL?.trim());

/** Failure from a model call. kind: rate_limit | unavailable | timeout | auth | blocked | bad_request | not_configured. The message never contains a key. */
export class AiError extends Error {
  constructor(kind, message, extra = {}) { super(message); this.name = "AiError"; this.kind = kind; Object.assign(this, extra); }
}
/** Errors worth trying the next model for. */
export const isRetryable = (e) => e instanceof AiError && ["rate_limit", "unavailable", "timeout"].includes(e.kind);
