"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Badge } from "@/components/kit";
import { routes } from "@/lib/routes.mjs";
import { Icon } from "./icons";
import { useQuickFind, type QfGroups, type QfItem } from "./useQuickFind";

// Quick-find: one box for a law, a judgment, or your own work. Opens from the top bar (or ⌘K / Ctrl+K); on a phone it takes the whole screen. Up and Down move, Enter opens the highlighted result
// (the first one to start with), Escape closes and returns focus to where it was. Presentation only; the searching is in useQuickFind.
const LABEL: Record<keyof QfGroups, string> = { go: "Go to", laws: "Laws", mentions: "Mentions", judgments: "Judgments", work: "Your work" };

export default function QuickFind() {
  const [open, setOpen] = useState(false), [q, setQ] = useState(""), [active, setActive] = useState(0), router = useRouter(), uid = useId();
  const input = useRef<HTMLInputElement>(null), back = useRef<HTMLElement | null>(null), box = useRef<HTMLDivElement>(null);
  const { groups, order, busy, ready, mentionsLabel } = useQuickFind(open, q), label = (g: keyof QfGroups) => (g === "mentions" ? mentionsLabel : LABEL[g]);
  const flat: QfItem[] = order.flatMap((g) => groups[g]);
  const show = () => { back.current = document.activeElement as HTMLElement; setOpen(true); };
  const hide = () => { setOpen(false); setQ(""); setActive(0); setTimeout(() => back.current?.focus(), 0); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open ? hide() : show(); } };
    document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) { input.current?.focus(); const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = prev; }; } }, [open]);
  useEffect(() => { setActive(0); }, [q, flat.length]);
  const go = (it?: QfItem) => { if (!it) return; hide(); router.push(it.href); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); hide(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, Math.max(0, flat.length - 1))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(flat[active]); }
    else if (e.key === "Tab" && box.current) {   // keep Tab inside the box
      const f = [...box.current.querySelectorAll<HTMLElement>("input,button,a[href]")]; if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  let n = -1;
  return (
    <>
      <button type="button" onClick={show} aria-haspopup="dialog" aria-label="Quick-find (Control or Command K)"
        className="hidden h-9 w-quickfind items-center gap-2 rounded-button bg-surface pl-3 pr-2 text-ui-base text-muted ring-1 ring-control-border hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary md:flex">
        <Icon name="search" /><span className="flex-1 text-left">Quick-find</span><kbd className="rounded-tight bg-raised px-1.5 py-1 font-mono text-fs-micro leading-none text-muted">⌘K</kbd>
      </button>
      <button type="button" onClick={show} aria-haspopup="dialog" aria-label="Quick-find" className="grid size-9 place-items-center rounded-button text-muted hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary md:hidden"><Icon name="search" className="size-5" /></button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/40 md:px-4 md:pt-24" onMouseDown={(e) => { if (e.target === e.currentTarget) hide(); }}>
          <div ref={box} role="dialog" aria-modal="true" aria-label="Quick-find" onKeyDown={onKey} className="flex h-full w-full max-w-dialog flex-col overflow-hidden bg-surface shadow-lg md:h-auto md:max-h-[70vh] md:rounded-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Icon name="search" className="size-5 text-muted" />
              <label htmlFor={`${uid}-q`} className="sr-only">Search laws, judgments and your work</label>
              <input id={`${uid}-q`} ref={input} role="combobox" aria-expanded aria-controls={`${uid}-list`} aria-activedescendant={flat[active] ? `${uid}-${flat[active].id}` : undefined} autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="138 NI Act, Order 7 Rule 11, Article 21, a case name, a draft…" className="min-w-0 flex-1 bg-transparent text-ui-lead text-foreground outline-none placeholder:text-muted" />
              <button type="button" onClick={hide} aria-label="Close Quick-find" className="grid size-8 place-items-center rounded-button text-muted hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"><Icon name="close" /></button>
            </div>
            <div id={`${uid}-list`} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto px-2 py-2" data-lenis-prevent>
              {!ready && <p className="px-3 py-6 text-center text-ui-base text-muted">Type at least 2 characters. Enter opens the first result.</p>}
              {ready && !busy && flat.length === 0 && <p className="px-3 py-6 text-center text-ui-base text-muted">Nothing matched. <a className="text-primary underline" href={routes.searchPage()} onClick={hide}>Try Search</a>.</p>}
              {ready && order.map((g) => groups[g].length > 0 && (
                <div key={g} role="group" aria-label={label(g)} className="mb-1">
                  <p className="px-3 pb-1 pt-2 font-mono text-fs-nano font-medium uppercase tracking-caps-wide text-muted">{label(g)}</p>
                  {groups[g].map((it) => { n++; const on = n === active, idx = n; return (
                    <div key={it.id} id={`${uid}-${it.id}`} role="option" aria-selected={on} onMouseEnter={() => setActive(idx)} onClick={() => go(it)}
                      className={`flex cursor-pointer items-start gap-3 rounded-field px-3 py-2 ${on ? "bg-accent" : ""}`}>
                      <span className="min-w-0 flex-1"><span className="block truncate text-ui-body text-foreground">{it.title}</span>{it.sub && <span className="block truncate text-ui-sm text-muted">{it.sub}</span>}</span>
                      <Badge className="mt-0.5 shrink-0">{it.kind}</Badge>
                    </div>); })}
                </div>
              ))}
              {ready && busy && <p className="px-3 py-2 text-ui-sm text-muted" role="status">Searching…</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
