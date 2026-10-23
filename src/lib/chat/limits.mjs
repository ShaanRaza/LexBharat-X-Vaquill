// Chat limits. PURE logic: given what a browser (and everyone) has used, say whether another question is allowed and what to tell the user.
/** used: { day, week, month } = this browser's questions today / in the last 7 days, and month = ALL browsers this month. limits: { daily, weekly, monthlyGlobal }. */
export function evaluateLimits(used, limits) {
  if (used.month >= limits.monthlyGlobal) return { allowed: false, reason: "monthly", message: "The free testing allowance for this month has been used up. Please try again next month." };
  if (used.day >= limits.daily) return { allowed: false, reason: "daily", message: `You have reached today's limit of ${limits.daily} questions. It resets tomorrow.` };
  if (used.week >= limits.weekly) return { allowed: false, reason: "weekly", message: `You have reached this week's limit of ${limits.weekly} questions. Older questions drop out of the count day by day.` };
  return { allowed: true, reason: null, message: "", remainingToday: limits.daily - used.day - 1, remainingWeek: limits.weekly - used.week - 1 };
}

/** Limits from config with optional env overrides (CHAT_LIMIT_DAILY, CHAT_LIMIT_WEEKLY, CHAT_LIMIT_MONTHLY_GLOBAL). Bad or missing values keep the configured number. */
export function readLimits(config, env = {}) {
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : d; };
  return { daily: num(env.CHAT_LIMIT_DAILY, config.daily), weekly: num(env.CHAT_LIMIT_WEEKLY, config.weekly), monthlyGlobal: num(env.CHAT_LIMIT_MONTHLY_GLOBAL, config.monthlyGlobal) };
}
