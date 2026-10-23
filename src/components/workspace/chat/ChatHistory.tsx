"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

// Sidebar list of this browser's past chats. Fetches /api/chat; the chat page fires "lb-chats-changed" when a chat is created or answered.
type Item = { id: string; title: string };
export default function ChatHistory({ onNavigate }: { onNavigate?: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null), path = usePathname();
  const load = useCallback(() => { fetch("/api/chat", { cache: "no-store" }).then((r) => r.json()).then((j) => setItems(j.chats ?? [])).catch(() => setItems([])); }, []);
  useEffect(() => { load(); window.addEventListener("lb-chats-changed", load); return () => window.removeEventListener("lb-chats-changed", load); }, [load]);
  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete the chat “${title}”? This cannot be undone.`)) return;
    await fetch(`/api/chat/${id}`, { method: "DELETE" }).catch(() => null);
    load(); if (path === `/workspace/chat/${id}`) window.location.assign("/workspace/chat");
  }
  if (items === null) return <p className="px-3 text-ui-sm text-muted">Loading…</p>;
  if (!items.length) return <p className="px-3 text-ui-sm text-muted">No chats yet.</p>;
  return (
    <ul className="space-y-0.5">
      {items.map((c) => (
        <li key={c.id} className="group flex items-center">
          <Link href={`/workspace/chat/${c.id}`} onClick={onNavigate} aria-current={path === `/workspace/chat/${c.id}` ? "page" : undefined} title={c.title}
            className={`min-w-0 flex-1 truncate rounded-chip px-3 py-1.5 text-ui-sm ${path === `/workspace/chat/${c.id}` ? "bg-accent text-foreground" : "text-muted hover:bg-accent/60 hover:text-foreground"}`}>{c.title}</Link>
          <button type="button" onClick={() => remove(c.id, c.title)} aria-label={`Delete chat: ${c.title}`} className="rounded-chip px-1.5 py-1 text-ui-sm text-muted opacity-0 hover:bg-accent focus-visible:opacity-100 group-hover:opacity-100">×</button>
        </li>
      ))}
    </ul>
  );
}
