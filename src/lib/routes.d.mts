export const SUPREME_COURT: string;
export const routes: {
  desk(): string; ask(id?: string): string; askAbout(docId: string): string; askQuestion(q: string): string; searchPage(q?: string): string; library(q?: string): string; libraryCourt(court: string): string; law(actId: string, sectionKey?: string): string;
  judgment(court: string, year: string | number, caseId: string, page?: string | number): string; drafts(id?: string): string; reviews(id?: string): string; vault(id?: string): string; password(): string; admin(): string;
};
