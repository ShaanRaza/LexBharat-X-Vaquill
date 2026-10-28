// Monthly spend guard for a paid provider (config `spendGuard` in ai-models.json). PURE of app state: config, env and fetch are arguments; the only state is a per-process cache.
// creditStatus -> { provider, checked, remaining, limit, minRemaining, tripped, reason } and never throws. `tripped` is true only when the credit was read AND is below the minimum; if it cannot be read the provider stays in use (fail open) and `checked` is false.
let cache = null;   // { at, value }
export const resetGuardCache = () => { cache = null; };

export async function creditStatus({ config, env, fetchImpl = fetch, now = Date.now(), force = false }) {
  const g = config?.spendGuard;
  if (!g?.provider) return { provider: null, checked: false, tripped: false, reason: "no guard configured" };
  const pc = config.providers?.[g.provider] ?? {}, keyEnv = pc.keyEnv, key = keyEnv ? env[keyEnv]?.trim() : "";
  const base = { provider: g.provider, minRemaining: Number(g.minRemainingUsd) || 0 };
  if (!key) return { ...base, checked: false, tripped: false, reason: `${keyEnv ?? g.provider} key is not set` };
  if (!force && cache && cache.key === key && now - cache.at < (Number(g.cacheMs) || 0)) return cache.value;
  let value;
  try {
    const r = await fetchImpl(`${(pc.baseUrl ?? "").replace(/\/$/, "")}/key`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(6000) });
    const d = r.ok ? (await r.json())?.data : null;
    // no limit set on the key (limit null) means unlimited: nothing to guard
    if (!d) value = { ...base, checked: false, tripped: false, reason: `credit could not be read (${r.status})` };
    else if (typeof d.limit_remaining !== "number") value = { ...base, checked: true, remaining: null, limit: d.limit ?? null, tripped: false, reason: "the key has no spending limit" };
    else { const tripped = d.limit_remaining < base.minRemaining; value = { ...base, checked: true, remaining: d.limit_remaining, limit: d.limit ?? null, tripped, reason: tripped ? `below $${base.minRemaining.toFixed(2)}: everything uses free Gemini` : "ok" }; }
  } catch { value = { ...base, checked: false, tripped: false, reason: "credit could not be read (no answer)" }; }
  cache = { at: now, key, value };
  return value;
}
