// The five areas of the app and which one a page belongs to. PURE logic (no styling, no network). Phase 2 of docs/RESKIN-IA-PLAN.md: the pages are still at their old addresses, so each area
// points at where its feature lives today; Phases 3 to 6 move the addresses and change `href` here, nothing else.
export const AREAS = [
  { id: "desk", label: "Desk", href: "/workspace" },
  { id: "ask", label: "Ask", href: "/workspace/chat" },
  { id: "search", label: "Search", href: "/workspace/browse?tab=acts" },   // until the Search page exists (Phase 5) the Acts search box is where searching happens
  { id: "library", label: "Library", href: "/workspace/browse" },
  { id: "work", label: "Work", href: "/workspace/drafting" },
];
/** Tabs under the page title in Work (Drafts, Reviews, Documents). `feature` is the key in src/config/workspace.json that can switch one off. */
export const WORK_TABS = [
  { id: "drafts", label: "Drafts", href: "/workspace/drafting", feature: "drafting" },
  { id: "reviews", label: "Reviews", href: "/workspace/review", feature: "review" },
  { id: "documents", label: "Documents", href: "/workspace/vault", feature: "vault" },
];
const under = (path, base) => path === base || path.startsWith(`${base}/`);
/** The area a page belongs to, or null for pages outside the five areas (Privacy, Terms, Security, the password page, 404). */
export function areaOf(pathname, search = "") {
  const p = String(pathname ?? "").replace(/\/+$/, "") || "/";
  if (p === "/workspace") return "desk";
  if (under(p, "/workspace/chat")) return "ask";
  if (p === "/workspace/browse") return new URLSearchParams(search).get("tab") === "acts" ? "search" : "library";
  if (under(p, "/workspace/browse")) return "library";
  if (under(p, "/workspace/drafting") || under(p, "/workspace/review") || under(p, "/workspace/vault")) return "work";
  return null;
}
export const workTabOf = (pathname) => WORK_TABS.find((t) => under(String(pathname ?? ""), t.href))?.id ?? null;
/** Reading pages (a law, a judgment): the phone tab bar hides while scrolling down so the text has the screen. */
export const isReadingPage = (pathname) => /^\/workspace\/browse\/(acts\/[^/]+|judgments\/[^/]+\/[^/]+\/[^/]+)\/?$/.test(String(pathname ?? ""));
