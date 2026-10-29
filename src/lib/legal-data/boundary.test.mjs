// The legal-data boundary. (1) No code outside the data folders may run SQL on a legal-data table: it goes through src/lib/legal-data. (2) No other file imports a concrete store (the Neon, file and vector stores) directly: pages, routes, components and the chat, drafting
// and review logic import "@/lib/legal-data" (legal data) or "@/lib/app-db" (the app's own tables). Pure helpers (.mjs: query parsing, labels, citations) are not data access and stay importable.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("src"), DATA_DIRS = ["lib/legal-data", "lib/acts", "lib/judgments", "lib/sections", "lib/supplement"];
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.(ts|tsx|mjs)$/.test(e.name) && !/\.test\.mjs$|\.d\.mts$/.test(e.name)) files.push(f); } })(ROOT);
const rel = (f) => path.relative(ROOT, f).split(path.sep).join("/");
const outside = files.filter((f) => !DATA_DIRS.some((d) => rel(f).startsWith(d + "/")));

test("no SQL on a legal-data table outside the data folders", () => {
  const bad = outside.filter((f) => /act_sections|\bFROM acts\b|\bJOIN acts\b|act_missing_sections|\bsc_cases\b|reg_sections|reg_acts/.test(fs.readFileSync(f, "utf8"))).map(rel);
  assert.deepEqual(bad, []);
});

const STORE = /from\s+["']@\/lib\/(?:acts\/(?:searchStore|actText|quickLaws|regSearch|vectorStore|sectionText|regDb|db)|acts|judgments\/(?:scText|hcData|hcSearch|jsonStore|scMeta|statuteResolve|scSearch|scMatch)|judgments|sections)["']/;
const ALLOWED = ["lib/app-db.ts"];   // the one place that re-exports the connection helper for the app's own tables
test("nothing outside the data folders imports a concrete store", () => {
  const now = outside.filter((f) => STORE.test(fs.readFileSync(f, "utf8"))).map(rel).sort();
  const extra = now.filter((f) => !ALLOWED.includes(f));
  assert.deepEqual(extra, [], "These files import a concrete store directly. Import from @/lib/legal-data instead, or (for the app's own tables) from the db helper.");
});
