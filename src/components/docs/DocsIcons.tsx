import type { DocsIcon } from "@/data/docs/nav";

// Sidebar group icons. The public docs use a 14 px outline icon set (database, lightbulb, rocket, server, book-open, bell, code,
// sparkles, flask); these are original stroke drawings of the same subjects, not the icon font itself.
const PATHS: Record<DocsIcon, string[]> = {
  database: ["M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3z", "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5", "M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"],
  lightbulb: ["M9 18h6", "M10 21h4", "M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.3 1.4 1.3 2.2h4.6c0-.8.5-1.6 1.3-2.2A6 6 0 0 0 12 3z"],
  rocket: ["M5 15c-1.5 1-2 4-2 6 2 0 5-.5 6-2", "M14 4c3-1 6-1 7-1 0 1 0 4-1 7l-7 7-6-6z", "M9 12l3 3", "M15.5 8.5h.01"],
  server: ["M5 4h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M5 13h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z", "M7 7.5h.01", "M7 16.5h.01"],
  "book-open": ["M12 6c-2-1.5-5-2-9-2v14c4 0 7 .5 9 2 2-1.5 5-2 9-2V4c-4 0-7 .5-9 2z", "M12 6v14"],
  bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10 21a2 2 0 0 0 4 0"],
  code: ["M8 7l-5 5 5 5", "M16 7l5 5-5 5", "M14 4l-4 16"],
  sparkles: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z", "M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"],
  flask: ["M9 3h6", "M10 3v6L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9V3", "M7.5 15h9"],
};

export function DocsGroupIcon({ name }: { name: DocsIcon }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      {PATHS[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
