export type CreditStatus = { provider: string | null; checked: boolean; tripped: boolean; reason: string; remaining?: number | null; limit?: number | null; minRemaining?: number };
export function creditStatus(o: { config: unknown; env: Record<string, string | undefined>; fetchImpl?: typeof fetch; now?: number; force?: boolean }): Promise<CreditStatus>;
export function resetGuardCache(): void;
