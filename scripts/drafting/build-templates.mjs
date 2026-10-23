#!/usr/bin/env node
// Checks every template in content/templates/*.json and bundles them into src/content/templates.generated.json (read by the app). Runs before dev, build and start, so replacing a template file needs no code change.
// Fails (exit 1) with a list of problems if any template is invalid.
import fs from "node:fs";
import path from "node:path";
import { validateTemplate } from "../../src/lib/drafting/templates.mjs";

const DIR = "content/templates", OUT = "src/content/templates.generated.json";
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
const all = [], problems = [];
for (const f of files) {
  let t; try { t = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")); } catch (e) { problems.push(`${f}: not valid JSON (${e.message})`); continue; }
  const p = validateTemplate(t); if (p.length) problems.push(...p.map((x) => `${f}: ${x}`));
  if (t.id !== f.replace(/\.json$/, "")) problems.push(`${f}: id "${t.id}" must match the file name`);
  all.push(t);
}
if (new Set(all.map((t) => t.id)).size !== all.length) problems.push("duplicate template ids");
if (problems.length) { console.error("Template problems:\n - " + problems.join("\n - ")); process.exit(1); }
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(all));
console.log(`drafting templates: ${all.length} bundled (${all.map((t) => t.id).join(", ")})`);
