// Which Ask quality changes are switched on. PURE logic: the config file (src/config/chat-tuning.json) gives the default, an environment variable forces one switch for an evaluation run.
export const FLAGS = { hybridSearch: "CHAT_TUNING_HYBRID_SEARCH", statutoryRewrite: "CHAT_TUNING_STATUTORY_REWRITE", currentLaw: "CHAT_TUNING_CURRENT_LAW", citationCheck: "CHAT_TUNING_CITATION_CHECK" };

/** { hybridSearch, statutoryRewrite, currentLaw, citationCheck } as booleans. "1"/"true" forces on, "0"/"false" forces off, anything else uses the config. */
export function tuningFlags(cfg = {}, env = {}) {
  const out = {};
  for (const [flag, name] of Object.entries(FLAGS)) { const v = String(env[name] ?? "").trim().toLowerCase(); out[flag] = v === "1" || v === "true" ? true : v === "0" || v === "false" ? false : cfg[flag] === true; }
  return out;
}
