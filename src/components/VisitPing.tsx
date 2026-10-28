"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Counts one visit per workspace page per day (the server ignores repeats from the same browser). Sends only the page NAME, never the address, the chat or any text.
// The page NAMES stay the ones the insights page already counts (chat, drafting, review, vault, browse, home); only the addresses they come from moved with the new route tree.
const PAGE_OF: [RegExp, string][] = [[/^\/ask/, "chat"], [/^\/work\/drafts/, "drafting"], [/^\/work\/reviews/, "review"], [/^\/work\/vault/, "vault"], [/^\/(library|search|law|judgments)/, "browse"], [/^\/$/, "home"]];

export default function VisitPing() {
  const path = usePathname();
  useEffect(() => {
    if (!path || !PAGE_OF.some(([re]) => re.test(path))) return;   // only the app's own pages are counted
    const page = PAGE_OF.find(([re]) => re.test(path))?.[1] ?? "other";
    try { const k = `lb-visit-${page}-${new Date().toISOString().slice(0, 10)}`; if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); } catch { /* storage blocked: the server still counts once a day */ }
    fetch("/api/usage/visit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ page }), keepalive: true }).catch(() => null);
  }, [path]);
  return null;
}
