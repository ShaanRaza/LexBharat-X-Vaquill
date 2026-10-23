// The drafting templates, bundled from content/templates/*.json by scripts/drafting/build-templates.mjs (runs before dev, build and start).
import generated from "@/content/templates.generated.json";
import type { Template } from "./templates.mjs";

export const TEMPLATES = generated as unknown as Template[];
export const getTemplate = (id: unknown): Template | undefined => TEMPLATES.find((t) => t.id === id);
/** What the pages need to show a template (no section instructions). */
export const templateCard = (t: Template) => ({ id: t.id, title: t.title, description: t.description, style: t.style, docTitle: t.docTitle, fields: t.fields, sectionTitles: t.sections.map((s) => ({ id: s.id, title: s.title })), reliesOn: t.relies_on ?? [] });
export type TemplateCard = ReturnType<typeof templateCard>;
