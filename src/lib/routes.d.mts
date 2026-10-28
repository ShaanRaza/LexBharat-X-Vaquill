export const SUPREME_COURT: string;
export const routes: {
  desk(): string; ask(id?: string): string; askAbout(docId: string): string; searchPage(): string; library(): string; law(actId: string, sectionKey?: string): string;
  judgment(court: string, year: string | number, caseId: string, page?: string | number): string; drafts(id?: string): string; reviews(id?: string): string; documents(id?: string): string; password(): string;
};
