// Generating a draft: retrieve the law, then write the document section by section. LOGIC ONLY (no styling). Progress goes out through `send`, so the route can stream it.
// Rules enforced here, not just asked of the model: retrieved law only; missing facts become placeholders; a failed section is isolated (the rest is kept); references to law that were not
// retrieved and amounts that were never given are flagged.
import { sectionBodies } from "@/lib/legal-data";
import { AiError, aiModelFor, completeAi, streamAi } from "@/lib/ai";
import { fixIndiaCodeLinks } from "@/lib/docs/docType.mjs";
import { retrieveSources, citationOf, type ChatSource } from "@/lib/chat/retrieve";
import { findStatuteMentions, resolveMention } from "@/lib/chat/citations.mjs";
import { buildRewritePrompt, parseRewrite } from "@/lib/chat/rewrite.mjs";
import { buildDoc, docToText, inventedAmounts, unverifiedMentions, type Doc, type SectionText } from "./docmodel.mjs";
import { buildSectionPrompt, cleanSectionText } from "./prompts.mjs";
import { docTitleFor, fillTokens, relianceFor, remindersFor, resolveFields, type Template } from "./templates.mjs";
import type { BasisItem, Warnings } from "./store";

export type DraftEvent =
  | { type: "plan"; title: string; sections: { id: string; title: string; fixed: boolean }[] }
  | { type: "basis"; basis: BasisItem[]; note?: string }
  | { type: "checklist"; items: { id: string; text: string }[] }
  | { type: "note"; text: string }
  | { type: "section_start"; id: string }
  | { type: "delta"; id: string; text: string }
  | { type: "section_done"; id: string; text: string }
  | { type: "section_failed"; id: string; message: string };
export type DraftResult = { title: string; sections: SectionText[]; basis: BasisItem[]; checklist: { id: string; text: string }[]; warnings: Warnings; doc: Doc; model: string };

/** A readable title for the saved draft: "Service agreement: Acme Ltd". */
export function draftTitle(template: Template, values: Record<string, string>): string {
  const who = template.fields.find((f) => f.type === "text" && f.required && String(values[f.key] ?? "").trim());
  const base = template.title.replace(/\s*\(.*$/, "");
  return who ? `${base}: ${String(values[who.key]).trim().slice(0, 40)}` : base;
}

const strip = (t: string) => t.replace(/\s?\[\d{1,2}(?:\s*,\s*\d{1,2})*\]/g, "");

async function sourcesFor(template: Template, values: Record<string, string>, extra: string, resolved: ReturnType<typeof resolveFields>) {
  const reliance = relianceFor(template, values), forced = reliance.map((r) => r.lookup);
  const queries = (template.search_queries ?? []).map((q) => fillTokens(q, resolved)).filter((q) => !/\[[A-Z]/.test(q));
  let note: string | undefined;
  // a template with no fixed law (the general notice) gets its search queries from what the user says the matter is about
  if (!forced.length) {
    const topic = [values.subject, values.facts?.slice(0, 300), extra.slice(0, 200)].filter(Boolean).join(" — ");
    if (topic) { try { const rp = buildRewritePrompt({ question: topic }); queries.push(...parseRewrite((await completeAi("queryRewrite", { system: rp.system, messages: rp.messages, json: true })).text, topic)); } catch { note = "Search help was skipped because the model is busy, so fewer sections may have been found."; } }
  }
  const question = `${template.title}${values.subject ? `: ${values.subject}` : ""}`;
  const ret = await retrieveSources(question, [], queries, 8, forced);
  const basis: BasisItem[] = ret.sources.map((s) => {
    const key = `${s.actId}|${s.sectionKey}`, relied = ret.exactKeys.includes(key) && reliance.length > 0;
    const why = reliance.find((r) => { const m = /^(\d+[A-Za-z]{0,2})\s+(.*)$/.exec(r.lookup); return !!m && !!resolveMention(m[1], m[2], [{ n: s.n, number: s.number, actTitle: s.actTitle }]); })?.why ?? null;
    return { ...citationOf(s), relied: relied && !!why, why };
  });
  return { sources: ret.sources, basis, note };
}

/** Writes one section from the facts and the retrieved law. Throws AiError on failure (nothing partial is kept). */
export async function writeSection(o: { template: Template; sectionId: string; values: Record<string, string>; extra: string; sources: ChatSource[]; previous: { title: string; text: string }[]; onDelta?: (t: string) => void }): Promise<{ text: string; model: string }> {
  const section = o.template.sections.find((s) => s.id === o.sectionId)!;
  if (section.fixed) return { text: fillTokens(section.fixed, resolveFields(o.template, o.values)), model: "fixed text" };
  const p = buildSectionPrompt({ template: o.template, section, values: o.values, extra: o.extra, sources: o.sources, previous: o.previous });
  let raw = "", model = aiModelFor("drafting");
  for await (const ev of streamAi("drafting", { system: p.system, messages: p.messages })) { if (ev.type === "text") { raw += ev.text; o.onDelta?.(ev.text); } else if (ev.type === "done") model = ev.model; }
  const text = strip(cleanSectionText(fixIndiaCodeLinks(raw)));
  if (!text) throw new AiError("unavailable", "The model returned no text for this section.");
  return { text, model };
}

export async function runDraft(o: { template: Template; values: Record<string, string>; extra: string; send: (e: DraftEvent) => void }): Promise<DraftResult> {
  const { template, values, extra, send } = o;
  const resolved = resolveFields(template, values), title = docTitleFor(template, values);
  send({ type: "plan", title, sections: template.sections.map((s) => ({ id: s.id, title: s.title, fixed: !!s.fixed })) });
  send({ type: "checklist", items: remindersFor(template, values) });
  const { sources, basis, note } = await sourcesFor(template, values, extra, resolved);
  send({ type: "basis", basis, note });
  const sections: SectionText[] = []; let model = "fixed text", okGenerated = 0, generated = 0;
  for (const s of template.sections) {
    send({ type: "section_start", id: s.id });
    try {
      const r = await writeSection({ template, sectionId: s.id, values, extra, sources, previous: sections.filter((x) => x.status === "ok").map((x) => ({ title: x.title, text: x.text })), onDelta: (t) => send({ type: "delta", id: s.id, text: t }) });
      sections.push({ id: s.id, title: s.title, text: r.text, status: "ok" }); send({ type: "section_done", id: s.id, text: r.text });
      if (!s.fixed) { okGenerated++; model = r.model; }
    } catch (e) {
      sections.push({ id: s.id, title: s.title, text: "", status: "failed" });
      send({ type: "section_failed", id: s.id, message: e instanceof AiError && ["rate_limit", "unavailable", "timeout"].includes(e.kind) ? "The model was busy." : "The model could not write this section." });
    }
    if (!s.fixed) generated++;
  }
  if (generated > 0 && okGenerated === 0) throw new AiError("unavailable", "No section could be written.");
  const text = sections.filter((x) => x.status === "ok").map((x) => x.text).join("\n\n");
  const forMentions = sources.map((s) => ({ n: s.n, number: s.number, actTitle: s.actTitle }));
  const given = [...resolved.flatMap((f) => [f.value, f.display ?? ""]), extra, ...sources.map((s) => s.text)];
  const warnings: Warnings = { unverified: unverifiedMentions(text, forMentions), amounts: inventedAmounts(text, given) };
  const used = new Set(findStatuteMentions(text, forMentions).flatMap((m) => (m.source ? [m.source.n] : [])));   // which retrieved sections the draft actually names
  return { title: draftTitle(template, values), sections, basis: basis.map((b) => ({ ...b, used: used.has(b.n) })), checklist: remindersFor(template, values), warnings, doc: buildDoc(title, sections, { continueNumbering: template.style === "notice" }), model };
}

export { docToText };

/** Re-loads the texts of the sections a draft was based on (to retry one section in the same context). */
export async function loadSources(basis: BasisItem[]): Promise<ChatSource[]> {
  if (!basis.length) return [];
  const by = await sectionBodies(basis.map((b) => ({ actId: b.actId, sectionKey: b.sectionKey })), 4000);
  return basis.flatMap((b) => { const r = by.get(`${b.actId}|${b.sectionKey}`); return r?.body?.trim() ? [{ n: b.n, actId: b.actId, sectionKey: b.sectionKey, actTitle: b.actTitle, year: r.year, category: b.category, state: b.state, inForce: r.actStatus === "in_force", sourceUrl: r.sourceUrl, number: b.number, heading: b.heading, status: b.status, text: r.body, via: "draft" }] : []; });
}
