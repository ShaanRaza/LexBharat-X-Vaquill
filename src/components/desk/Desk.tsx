"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/kit";
import desk from "@/config/desk.json";
import workspace from "@/config/workspace.json";
import { routes } from "@/lib/routes.mjs";
import DeskBox from "./DeskBox";
import RecentWork from "./RecentWork";

// Desk, the home page (/): a greeting, one big box, shortcuts to Drafts, Reviews and the Vault, your recent work, and one honest line on what is covered. Presentation only; the box's logic is in DeskBox / useDesk.
const greet = (h: number) => (h < 12 ? "Good morning." : h < 17 ? "Good afternoon." : "Good evening.");
const SHORT = [{ key: "drafting", go: routes.drafts }, { key: "review", go: routes.reviews }, { key: "vault", go: routes.vault }] as const;

export default function Desk() {
  const [hello, setHello] = useState("Welcome.");
  useEffect(() => { setHello(greet(new Date().getHours())); }, []);   // after load: the greeting follows this device's clock
  const f = workspace.features;
  return (
    <div className="mx-auto max-w-3xl pb-10 pt-8 sm:pt-10">
      <p className="font-mono text-fs-nano font-medium uppercase tracking-caps-wide text-muted">Desk</p>
      <h1 className="mt-2 font-serif text-greeting">{hello}</h1>
      <p className="mt-2 text-ui-lead text-secondary">{desk.tagline}</p>
      <div className="mt-6"><DeskBox /></div>
      <nav aria-label="Shortcuts" className="mt-4 flex flex-wrap gap-2">
        {SHORT.filter((s) => f[s.key].enabled).map((s) => <Button key={s.key} href={s.go()} variant={s.key === "drafting" ? "primary" : "secondary"}>{f[s.key].action}</Button>)}
      </nav>
      <RecentWork />
      <p className="mt-8 max-w-2xl text-ui-sm text-muted"><strong className="font-medium text-foreground">What&apos;s included.</strong> {desk.coverage}</p>
    </div>
  );
}
