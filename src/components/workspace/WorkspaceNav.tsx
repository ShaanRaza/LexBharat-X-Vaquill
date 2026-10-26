"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/kit";
import { buttonClass } from "@/components/kit/controls";
import LogoutLink from "@/components/LogoutLink";
import ChatHistory from "@/components/workspace/chat/ChatHistory";
import DraftHistory from "@/components/workspace/drafting/DraftHistory";
import workspace from "@/config/workspace.json";

// Sidebar of the Legal Workspace product (also the contents of the phone menu): New chat, Dashboard, Chat with its past chats, Acts & Judgments, then Drafting / Review / Vault, which stay
// greyed with "Coming soon" until their flag in src/config/workspace.json is switched on. Presentation only; colours, sizes and radii come from the tokens.
export type LawTab = "dashboard" | "chat" | "browse" | "drafting" | "review" | "vault";
const PATHS = {
  dashboard: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  chat: "M4 5h16v11H9l-5 4z",
  browse: "M5 4h4v16H5zM10 4h4v16h-4zM15.6 5.4l3.6-1 3.2 14.6-3.6 1z",
  drafting: "M4 20l4-1 11-11-3-3L5 16zM14 6l3 3",
  review: "M6 3h9l4 4v14H6zM9 13l2 2 4-4",
  vault: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  plus: "M12 5v14M5 12h14",
} as const;
function Icon({ name }: { name: keyof typeof PATHS }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[name]} /></svg>;
}
const ROW = "flex items-center gap-3 rounded-button px-3 py-2.5 text-ui-base transition-colors";
const on = "bg-primary/10 font-medium text-primary", off = "text-secondary hover:bg-accent hover:text-foreground";

function Item({ href, icon, label, active, onNavigate }: { href: string; icon: keyof typeof PATHS; label: string; active: boolean; onNavigate?: () => void }) {
  return <Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`${ROW} ${active ? on : off}`}><Icon name={icon} /><span className="leading-tight">{label}</span></Link>;
}
function Soon({ icon, label }: { icon: keyof typeof PATHS; label: string }) {
  return <span role="link" aria-disabled="true" title={`${label} is coming soon`} className={`${ROW} cursor-not-allowed text-muted/60`}><Icon name={icon} /><span className="leading-tight">{label}</span><Badge className="ml-auto whitespace-nowrap">Coming soon</Badge></span>;
}

export default function WorkspaceNav({ active, logo, onNavigate }: { active?: LawTab; logo: ReactNode; onNavigate?: () => void }) {
  const feats = Object.entries(workspace.features) as [keyof typeof PATHS, (typeof workspace.features)["drafting"]][];
  return (
    <nav aria-label="Legal Workspace" className="flex h-full flex-col">
      {logo}
      <div className="px-3 pb-3">
        <Link href="/workspace/chat" onClick={onNavigate} className={buttonClass("primary", "md", "w-full")}><Icon name="plus" />New chat</Link>
      </div>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2" data-lenis-prevent>
        <li><Item href="/workspace" icon="dashboard" label="Dashboard" active={active === "dashboard"} onNavigate={onNavigate} /></li>
        <li>
          <Item href="/workspace/chat" icon="chat" label="Chat" active={active === "chat"} onNavigate={onNavigate} />
          <div className="ml-4 mt-0.5 max-h-52 overflow-y-auto border-l border-border pl-2" data-lenis-prevent><ChatHistory onNavigate={onNavigate} /></div>
        </li>
        <li><Item href="/workspace/browse" icon="browse" label="Acts & Judgments" active={active === "browse"} onNavigate={onNavigate} /></li>
        {feats.map(([key, f]) => (
          <li key={key}>
            {f.enabled ? <Item href={f.href} icon={key} label={f.label} active={active === key} onNavigate={onNavigate} /> : <Soon icon={key} label={f.label} />}
            {f.enabled && key === "drafting" && <div className="ml-4 mt-0.5 max-h-44 overflow-y-auto border-l border-border pl-2" data-lenis-prevent><DraftHistory onNavigate={onNavigate} /></div>}
          </li>
        ))}
      </ul>
      <div className="space-y-1 px-5 pb-4 pt-3">
        <p className="text-ui-xs text-muted">Your chats are saved on this browser only.</p>
        <LogoutLink />
      </div>
    </nav>
  );
}
