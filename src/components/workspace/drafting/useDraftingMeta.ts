"use client";
import { useCallback, useEffect, useState } from "react";
import type { TemplateCard } from "@/lib/drafting/catalog";
import type { DraftSummary } from "@/lib/drafting/store";

export type DraftingMeta = { templates: TemplateCard[]; drafts: DraftSummary[]; emailAvailable: boolean; limits: { daily: number; weekly: number; maxSaved: number }; usage: { day: number; week: number }; ready: boolean; error?: string };
/** Loads /api/drafting (templates, this browser's drafts, usage, whether email is available). `reload` refetches. */
export function useDraftingMeta() {
  const [meta, setMeta] = useState<DraftingMeta | null>(null), [failed, setFailed] = useState(false);
  const reload = useCallback(() => { fetch("/api/drafting", { cache: "no-store" }).then((r) => r.json()).then((j) => { setMeta(j); setFailed(false); }).catch(() => setFailed(true)); }, []);
  useEffect(() => { reload(); window.addEventListener("lb-drafts-changed", reload); return () => window.removeEventListener("lb-drafts-changed", reload); }, [reload]);
  return { meta, failed, reload };
}
