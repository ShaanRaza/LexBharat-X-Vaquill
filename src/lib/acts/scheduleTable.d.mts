export type ScheduleRow = { kind: "limitation" | "stamp"; article: string; cells: string[]; group: string; startsGroup?: boolean };
export type ScheduleTable = { kind: "limitation" | "stamp" | null; title?: string; labels?: string[]; columns?: string[]; rows: ScheduleRow[] };
export function tableKindOf(body: string | null | undefined): "limitation" | "stamp" | null;
export function articleRow(number: string, body: string | null | undefined): ScheduleRow | null;
export function buildScheduleTable(units: { number: string; body: string | null }[]): ScheduleTable;
