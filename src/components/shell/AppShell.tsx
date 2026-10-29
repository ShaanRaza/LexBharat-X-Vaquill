import StickyHeader from "./StickyHeader";
import TabBar from "./TabBar";
import TopBar from "./TopBar";
import WorkTabs from "./WorkTabs";

// The frame of every page inside the app: the top bar, the testing banner (one line, until launch), the page, and on phones the bottom tab bar. Replaces the old left sidebar (Phase 2 of
// docs/RESKIN-IA-PLAN.md). Presentation only; colours, sizes and spacing come from the tokens.
// The testing banner. On a desktop it is part of the sticky header, so it is always fully visible under the bar; on a phone (where two lines would cost too much of a small screen) it sits above the bar and
// scrolls away cleanly. The wrapper behind it is opaque, so nothing shows through. Only one of the two is displayed at a time.
function TestingBanner({ className = "" }: { className?: string }) {
  return (
    <aside aria-label="Testing phase notice" className={`border-b border-quality-warn/30 bg-quality-warn/10 text-ui-sm text-foreground ${className}`}>
      <p className="mx-auto max-w-app px-page py-1.5"><strong className="font-medium">Testing phase:</strong> don&apos;t enter confidential client information. Answers are not legal advice.</p>
    </aside>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell min-h-screen bg-background">
      <TestingBanner className="md:hidden" />
      <StickyHeader>
        <TopBar />
        <TestingBanner className="hidden md:block" />
      </StickyHeader>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-app px-page pb-page-bottom pt-2 outline-none">
        <WorkTabs />
        {children}
      </main>
      <TabBar />
    </div>
  );
}
