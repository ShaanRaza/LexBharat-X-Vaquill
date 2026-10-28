// Every address the app links to, built in ONE place. PURE. Today these are the pages' current addresses; Phase 3 of docs/RESKIN-IA-PLAN.md changes the values here (and the redirects), not the pages.
const enc = encodeURIComponent;
export const routes = {
  desk: () => "/workspace",
  ask: (id) => (id ? `/workspace/chat/${enc(id)}` : "/workspace/chat"),
  askAbout: (docId) => `/workspace/chat?doc=${enc(docId)}`,
  searchPage: () => "/workspace/browse?tab=acts",
  library: () => "/workspace/browse",
  law: (actId, sectionKey) => `/workspace/browse/acts/${enc(actId)}${sectionKey ? `?section=${enc(sectionKey)}` : ""}`,
  judgment: (court, year, caseId, page) => `/workspace/browse/judgments/${enc(court)}/${enc(year)}/${enc(caseId)}${page ? `?p=${enc(page)}` : ""}`,
  drafts: (id) => (id ? `/workspace/drafting/${enc(id)}` : "/workspace/drafting"),
  reviews: (id) => (id ? `/workspace/review/${enc(id)}` : "/workspace/review"),
  documents: (id) => (id ? `/workspace/vault/${enc(id)}` : "/workspace/vault"),
  password: () => "/access",
};
export const SUPREME_COURT = "supreme-court-of-india";
