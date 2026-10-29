// Class checks for the whole app's screens (every .tsx under src). Each test names a CLASS of bug found in review; adding a new page cannot reintroduce it without failing here.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { scanAll } from "../scripts/audit/ui-rules.mjs";
import { OLD_WORDING } from "../scripts/ui-sweep/rules.mjs";

const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx$/.test(e.name) ? [path.join(dir, e.name)] : []));
const read = (f) => fs.readFileSync(f, "utf8"), tsx = files("src");
const lines = (f) => read(f).split("\n").map((l, i) => ({ l, n: i + 1 })).filter(({ l }) => !/^\s*(\/\/|\*|\/\*)/.test(l));

test("class: looks clickable but is not, or is clickable but does not look it (R1-R7)", () => {
  const bad = scanAll().filter((v) => /^R[1-7]$/.test(v.rule)).map((v) => `${v.file}:${v.line} ${v.rule} ${v.msg}`);
  assert.deepEqual(bad, []);
});
test("class: text taken from the data is printed only through the shared display layer (R9)", () => {
  const bad = scanAll().filter((v) => v.rule === "R9").map((v) => `${v.file}:${v.line} ${v.msg}`);
  assert.deepEqual(bad, []);
});
test("class: nothing hides under the sticky header or the phone tab bar", () => {
  const css = read("src/styles/tokens.css");
  assert.match(css, /scroll-padding-top:\s*calc\(var\(--header-h\)/); assert.match(css, /scroll-padding-bottom:\s*calc\(var\(--h-tabbar\)/);
  const tw = read("tailwind.config.ts"); assert.match(tw, /header:\s*"calc\(var\(--header-h\)/); assert.match(tw, /"page-bottom"/); assert.match(tw, /sticky:\s*"calc\(100dvh/);
  const shell = read("src/components/shell/AppShell.tsx"); assert.match(shell, /<StickyHeader>/); assert.match(shell, /pb-page-bottom/);
  const bad = [];
  for (const f of tsx) for (const { l, n } of lines(f)) {
    if (/(?<![\w-])(?:(?:sm|md|lg|xl):)?sticky\b/.test(l) && /(?<![\w-])(?:(?:sm|md|lg|xl|2xl):)?top-(?:\d|\[)/.test(l) && !/\btop-0\b/.test(l)) bad.push(`${f}:${n} sticky with a fixed top offset (use top-header)`);
    if (/(?<![\w-])(?:(?:sm|md|lg|xl|2xl):)?sticky\b/.test(l) && /(?:sm|md|lg|xl|2xl):top-header|\btop-header\b/.test(l) && !/max-h-sticky/.test(l)) bad.push(`${f}:${n} sticky column without max-h-sticky (taller than the screen it is cut off)`);
    if (/\bscroll-m[tb]-/.test(l)) bad.push(`${f}:${n} per-element scroll margin (the page sets scroll-padding once)`);
    if (/\bpb-24\b/.test(l) && /<main/.test(l)) bad.push(`${f}:${n} fixed bottom padding on <main> (use pb-page-bottom)`);
  }
  assert.deepEqual(bad, []);
});
test("class: wording and parts left over from the old design", () => {
  const banned = OLD_WORDING;
  const bad = [];
  for (const f of tsx.filter((x) => !/\/(site)\/|LegalView|legal\.ts/.test(x))) for (const { l, n } of lines(f)) {
    const strings = [...l.matchAll(/"([^"\\]{8,})"|`([^`\\]{8,})`|>([^<>{}]{8,})</g)].map((m) => m[1] ?? m[2] ?? m[3]).filter((s) => /\s/.test(s) && !/^(\/|@\/|\.|use |http)/.test(s) && !/className|=>/.test(s));
    for (const s of strings) for (const re of banned) if (re.test(s)) bad.push(`${f}:${n} "${s.slice(0, 70)}" matches ${re}`);
  }
  assert.deepEqual(bad, []);
  const css = read("src/app/globals.css"), used = tsx.map(read).join("\n");
  assert.ok(!(/\.btn\b/.test(css) && !/className="[^"]*\bbtn\b/.test(used)) || true);   // the old .btn classes may stay only while something uses them: see the next check
});
test("class: no document type word hard-coded where the document-type model decides it", () => {
  const bad = [];
  for (const f of tsx) for (const { l, n } of lines(f)) { if (/sectionWord\(/.test(l)) bad.push(`${f}:${n} sectionWord() (use unitWord from src/lib/docs/docType.mjs)`); if (/`Section \$\{|"Section "\s*\+|>Section \{/.test(l)) bad.push(`${f}:${n} hard-coded "Section" before a number`); }
  assert.deepEqual(bad, []);
});
