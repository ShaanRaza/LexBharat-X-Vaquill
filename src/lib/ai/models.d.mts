export const PROVIDERS: string[];
export function parseModelSpec(spec: string): { provider: string; model: string };
export function resolveTask(task: string, config: unknown, env?: Record<string, string | undefined>): { task: string; primary: { provider: string; model: string }; fallbacks: { provider: string; model: string }[]; thinking: string; temperature: number; maxOutputTokens: number; timeoutMs: number; firstTokenMs: number; json: boolean };
export const providerKeyName: (provider: string) => string;
export function providerConfigured(provider: string, env: Record<string, string | undefined>): boolean;
export class AiError extends Error { kind: "rate_limit" | "unavailable" | "timeout" | "auth" | "blocked" | "bad_request" | "not_configured"; status?: number; retryAfterSec?: number; detail?: string; constructor(kind: AiError["kind"], message: string, extra?: Record<string, unknown>) }
export function isRetryable(e: unknown): boolean;
