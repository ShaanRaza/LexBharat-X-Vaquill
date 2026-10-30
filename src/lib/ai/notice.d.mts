export function aiFailure(e: unknown, what?: { counted?: string }): { family: "limit" | "busy" | "not_set_up" | "blocked" | "failed"; code: "limit" | "busy" | "not_set_up" | "blocked" | "failed"; busy: boolean; message: string };
export function aiReason(e: unknown): string;
