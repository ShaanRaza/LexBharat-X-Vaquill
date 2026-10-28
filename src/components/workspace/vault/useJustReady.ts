"use client";
import { useEffect, useRef, useState } from "react";
import { newlyReady } from "@/lib/vault/links.mjs";
import type { VaultDoc } from "@/lib/vault/store";

// Documents that finished preparing while this page was open (so the page can say what to do next). Logic only; the page decides how to show it.
export function useJustReady(docs: VaultDoc[] | undefined) {
  const prev = useRef<VaultDoc[] | null>(null), [ready, setReady] = useState<VaultDoc[]>([]);
  useEffect(() => {
    if (!docs) return;
    if (prev.current) { const fresh = newlyReady(prev.current, docs); if (fresh.length) setReady((r) => [...r.filter((x) => !fresh.some((f) => f.id === x.id)), ...fresh]); }
    prev.current = docs;
  }, [docs]);
  return { ready, dismiss: (id: string) => setReady((r) => r.filter((d) => d.id !== id)) };
}
