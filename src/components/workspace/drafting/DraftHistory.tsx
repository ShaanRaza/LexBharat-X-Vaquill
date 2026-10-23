"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Sidebar list of this browser's saved drafts, under Drafting. Reloads when a draft is made, renamed or deleted ("lb-drafts-changed").
type Item = { id: string; title: string };
export default function DraftHistory({ onNavigate }: { onNavigate?: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null), path = usePathname();
  useEffect(() => {
    const load = () => fetch("/api/drafting", { cache: "no-store" }).then((r) => r.json()).then((j) => setItems(j.drafts ?? [])).catch(() => setItems([]));
    load(); window.addEventListener("lb-drafts-changed", load); return () => window.removeEventListener("lb-drafts-changed", load);
  }, []);
  if (items === null) return <p className="px-3 text-ui-sm text-muted">Loading…</p>;
  if (!items.length) return <p className="px-3 text-ui-sm text-muted">No drafts yet.</p>;
  return (
    <ul className="space-y-0.5">
      {items.map((d) => (
        <li key={d.id}><Link href={`/workspace/drafting/${d.id}`} onClick={onNavigate} title={d.title} aria-current={path === `/workspace/drafting/${d.id}` ? "page" : undefined}
          className={`block truncate rounded-chip px-3 py-1.5 text-ui-sm ${path === `/workspace/drafting/${d.id}` ? "bg-accent text-foreground" : "text-muted hover:bg-accent/60 hover:text-foreground"}`}>{d.title}</Link></li>
      ))}
    </ul>
  );
}
