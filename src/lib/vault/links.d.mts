export const chatLink: (id: string) => string;
export const reviewLink: (id: string) => string;
export const previewLink: (id: string) => string;
export const docFromSearch: (search: string) => string | null;
export const newlyReady: <T extends { id: string; status: string }>(before: T[], after: T[]) => T[];
