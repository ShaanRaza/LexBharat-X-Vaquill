export function emailConfigured(env: Record<string, string | undefined>): boolean;
export function validEmail(s: unknown): boolean;
export function buildReadyEmail(o: { to: string; from: string; title: string; link: string }): { from: string; to: string[]; subject: string; html: string; text: string };
export function sendReadyEmail(o: { env: Record<string, string | undefined>; to: string; title: string; link: string; fetchImpl?: typeof fetch }): Promise<{ ok: true } | { ok: false; reason: string }>;
