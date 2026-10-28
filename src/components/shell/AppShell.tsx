import TabBar from "./TabBar";
import TopBar from "./TopBar";
import WorkTabs from "./WorkTabs";

// The frame of every page inside the app: the top bar, the testing banner (one line, until launch), the page, and on phones the bottom tab bar. Replaces the old left sidebar (Phase 2 of
// docs/RESKIN-IA-PLAN.md). Presentation only; colours, sizes and spacing come from the tokens.
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell min-h-screen bg-background">
      <TopBar />
      <aside aria-label="Testing phase notice" className="border-b border-quality-warn/30 bg-quality-warn/10 text-ui-sm text-foreground">
        <p className="mx-auto max-w-app px-page py-1.5"><strong className="font-medium">Testing phase:</strong> don&apos;t enter confidential client information. Answers are not legal advice.</p>
      </aside>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-app px-page pb-24 pt-2 outline-none">
        <WorkTabs />
        {children}
      </main>
      <TabBar />
    </div>
  );
}
