import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// India Code moved to indiacode.gov.in. Every India Code address the app shows is made in ONE place (src/lib/docs/docType.mjs: liveIndiaCodeUrl, indiaCodeSearchUrl, fixIndiaCodeLinks), reached through
// sourceInfo (pages) or officialSourceUrl (chat, with the Act's title). Nothing else may build or hold one, so a change of address is a one-file change.
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(ROOT).filter((f) => /\.(?:ts|tsx|mjs|json)$/.test(f) && !/\.test\.mjs$/.test(f));
const read = (f) => fs.readFileSync(f, "utf8");

test("no source file other than docType.mjs names an India Code host or builds an India Code address", () => {
  const bad = files.filter((f) => !f.endsWith("src/lib/docs/docType.mjs") && /indiacode\.(?:nic|gov)\.in/.test(read(f)));
  assert.deepEqual(bad.map((f) => path.relative(ROOT, f)), []);
});
test("every officialSourceUrl call that has an Act in hand passes its title (so chat links are the search for that Act)", () => {
  for (const f of ["app/api/chat/route.ts", "lib/chat/retrieve.ts"]) {
    const calls = read(path.join(ROOT, f)).match(/officialSourceUrl\((?:[^()]|\([^()]*\))*\)/g) ?? [];
    assert.ok(calls.length > 0, f);
    for (const c of calls) assert.match(c, /,\s*\S+/, `${f}: ${c}`);
  }
});
test("the chat answer and the draft text go through fixIndiaCodeLinks", () => {
  assert.match(read(path.join(ROOT, "app/api/chat/route.ts")), /fixIndiaCodeLinks\(clean\.text\)/);
  assert.match(read(path.join(ROOT, "lib/drafting/generate.ts")), /fixIndiaCodeLinks\(raw\)/);
  assert.match(read(path.join(ROOT, "lib/ai/run.mjs")), /fixIndiaCodeLinks\(text\)/);
});
