export type Limits = { daily: number; weekly: number; monthlyGlobal: number };
export function evaluateLimits(used: { day: number; week: number; month: number }, limits: Limits): { allowed: boolean; reason: "monthly" | "daily" | "weekly" | null; message: string; remainingToday?: number; remainingWeek?: number };
export function readLimits(config: Limits, env?: Record<string, string | undefined>): Limits;
