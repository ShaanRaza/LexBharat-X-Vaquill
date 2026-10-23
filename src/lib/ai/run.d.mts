export function streamTask(task: string, input: unknown, ctx: { config: unknown; env: Record<string, string | undefined>; fetchImpl?: typeof fetch }): AsyncGenerator<unknown>;
export function completeTask(task: string, input: unknown, ctx: { config: unknown; env: Record<string, string | undefined>; fetchImpl?: typeof fetch }): Promise<{ text: string; usage: unknown; model: string | null }>;
