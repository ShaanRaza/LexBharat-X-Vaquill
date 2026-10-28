// Every address the app links to, built in ONE place. PURE. The five areas and where their pages live (docs/RESKIN-IA-PLAN.md, section 1.5): Desk /, Ask /ask, Search /search, Library /library (and /law, /judgments),
// Work /work/drafts, /work/reviews, /work/vault. Old addresses redirect permanently (src/config/redirects.mjs).
const enc = encodeURIComponent;
export const routes = {
  desk: () => "/",
  ask: (id) => (id ? `/ask/${enc(id)}` : "/ask"),
  askAbout: (docId) => `/ask?doc=${enc(docId)}`,
  askQuestion: (q) => `/ask?q=${enc(q)}`,
  searchPage: (q) => (q ? `/search?q=${enc(q)}` : "/search"),
  library: (q) => (q ? `/library?q=${enc(q)}` : "/library"),
  libraryCourt: (court) => `/library/judgments/${enc(court)}`,
  law: (actId, sectionKey) => `/law/${enc(actId)}${sectionKey ? `/${enc(sectionKey)}` : ""}`,
  judgment: (court, year, caseId, page) => `/judgments/${enc(court)}/${enc(year)}/${enc(caseId)}${page ? `?p=${enc(page)}` : ""}`,
  drafts: (id) => (id ? `/work/drafts/${enc(id)}` : "/work/drafts"),
  reviews: (id) => (id ? `/work/reviews/${enc(id)}` : "/work/reviews"),
  vault: (id) => (id ? `/work/vault/${enc(id)}` : "/work/vault"),
  password: () => "/access",
  admin: () => "/admin",
};
export const SUPREME_COURT = "supreme-court-of-india";
