export type AreaId = "desk" | "ask" | "search" | "library" | "work";
export const AREAS: readonly { id: AreaId; label: string; href: string }[];
export const WORK_TABS: readonly { id: "drafts" | "reviews" | "documents"; label: string; href: string; feature: "drafting" | "review" | "vault" }[];
export function areaOf(pathname: string, search?: string): AreaId | null;
export function workTabOf(pathname: string): "drafts" | "reviews" | "documents" | null;
export function isReadingPage(pathname: string): boolean;
