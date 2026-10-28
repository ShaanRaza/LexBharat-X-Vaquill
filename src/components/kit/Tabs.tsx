import Link from "next/link";

// A row of tabs under a page title (Work: Drafts, Reviews, Documents). Links, not buttons: each tab is a page. The current one is underlined in the brand colour. Colours and sizes come from the tokens.
export type TabItem = { id: string; label: string; href: string; count?: number };
export default function Tabs({ items, current, label, className = "" }: { items: TabItem[]; current: string | null; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={`flex gap-1 overflow-x-auto border-b border-border ${className}`}>
      {items.map((t) => {
        const on = t.id === current;
        return (
          <Link key={t.id} href={t.href} aria-current={on ? "page" : undefined}
            className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-ui-base focus-visible:outline-2 focus-visible:outline-primary ${on ? "border-primary font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"}`}>
            {t.label}{t.count !== undefined && <span className="font-mono text-fs-xs text-muted">{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
