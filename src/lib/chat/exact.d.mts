export function narrowToExact<T extends { actId: string }>(hits: T[], exactKeys: string[], keyOf: (h: T) => string, extra?: number): T[];
