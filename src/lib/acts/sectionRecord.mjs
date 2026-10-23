// The ONE place that decides what a built section looks like once it is stored for display and search (Neon rows, API). PURE logic, no styling.
// Garbled sections keep their row (so the Act page can show the "unreliable" message) but their text is never stored.
import { cleanHeading } from "./cleanText.mjs";

export function chapterLabel(section) {
  if (!section.chapter) return null;
  const name = cleanHeading(section.chapter.name);
  return [`Chapter ${section.chapter.roman}`, name].filter(Boolean).join(" — ");
}

/** Section number as shown: the dataset's number for sections, null for unnumbered blocks. */
export const shownNumber = (section) => (section.kind === "s" && section.number ? section.number : null);

export function toSectionRecord(section, ord) {
  const garbled = section.status === "garbled";
  return {
    sectionKey: section.key, ord, number: shownNumber(section), heading: cleanHeading(section.heading), chapter: chapterLabel(section),
    status: section.status, flags: section.flags, chunkCount: section.chunkCount,
    body: garbled ? null : (section.displayText ?? section.text),
  };
}
