"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/kit";
import { AREAS, areaOf } from "@/lib/shell/areas.mjs";
import QuickFind from "./QuickFind";
import UserMenu from "./UserMenu";

// The slim top bar: the ¶ LexBharat logo (goes to Desk), the five areas (the current one underlined in the brand colour), Quick-find and the small menu. On a phone the areas move to the bottom tab bar.
// Presentation only; which area is current comes from src/lib/shell/areas.mjs.
export default function TopBar() {
  const pathname = usePathname(), area = areaOf(pathname);
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto grid h-topbar max-w-app grid-cols-[1fr_auto] items-center gap-6 px-page md:grid-cols-[auto_1fr_auto]">
        <Logo href={AREAS[0].href} />
        <nav aria-label="Areas" className="hidden h-full justify-center md:flex">
          {AREAS.map((a) => (
            <Link key={a.id} href={a.href} aria-current={area === a.id ? "page" : undefined}
              className={`-mb-px flex items-center border-b-2 px-4 text-ui-base focus-visible:outline-2 focus-visible:outline-primary ${area === a.id ? "border-primary font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"}`}>{a.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5"><QuickFind /><UserMenu /></div>
      </div>
    </header>
  );
}
