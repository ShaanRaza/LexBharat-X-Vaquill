// The five areas of the app and which one a page belongs to. PURE logic (no styling, no network). The pages live at the addresses of docs/RESKIN-IA-PLAN.md, section 1.5 (Phase 3).
export const AREAS = [
  { id: "desk", label: "Desk", href: "/" },
  { id: "ask", label: "Ask", href: "/ask" },
  { id: "search", label: "Search", href: "/search" },
  { id: "library", label: "Library", href: "/library" },
  { id: "work", label: "Work", href: "/work/drafts" },
];
/** Tabs under the page title in Work (Drafts, Reviews, Vault). `feature` is the key in src/config/workspace.json that can switch one off. */
export const WORK_TABS = [
  { id: "drafts", label: "Drafts", href: "/work/drafts", feature: "drafting" },
  { id: "reviews", label: "Reviews", href: "/work/reviews", feature: "review" },
  { id: "vault", label: "Vault", href: "/work/vault", feature: "vault" },
];
const under = (path, base) => path === base || path.startsWith(`${base}/`);
/** The area a page belongs to, or null for pages outside the five areas (Privacy, Terms, Security, the password page, admin, 404). Decided by the path alone, so it works while a page is built on the server. */
export function areaOf(pathname) {
  const p = String(pathname ?? "").replace(/\/+$/, "") || "/";
  if (p === "/") return "desk";
  if (under(p, "/ask")) return "ask";
  if (under(p, "/search")) return "search";
  if (under(p, "/library") || under(p, "/law") || under(p, "/judgments")) return "library";
  if (under(p, "/work")) return "work";
  return null;
}
export const workTabOf = (pathname) => WORK_TABS.find((t) => under(String(pathname ?? ""), t.href))?.id ?? null;
/** Reading pages (a law, a judgment): the phone tab bar hides while scrolling down so the text has the screen. */
export const isReadingPage = (pathname) => /^\/(law\/[^/]+(\/[^/]+)?|judgments\/[^/]+\/[^/]+\/[^/]+)\/?$/.test(String(pathname ?? ""));
