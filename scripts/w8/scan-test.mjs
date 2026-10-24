// W8 scanned-document tests against a running dev server. usage: TEST_PW=<throwaway access password> node scripts/w8/scan-test.mjs [file ...]   (files are in ../lexbharat-data/w8-test-files; BASE defaults to http://localhost:3100)
// Prints one line per file: state, time, pages read, and (where we know the original) how many of the original's words the reading found. Reads .env.local only for the Supabase checks; prints no secrets.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const B = process.env.BASE ?? "http://localhost:3100", PW = process.env.TEST_PW, DIR = "../lexbharat-data/w8-test-files/";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { pdf: "application/pdf", jpg: "image/jpeg", png: "image/png" };
export const login = async () => (await fetch(B + "/api/access/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: PW }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
export const api = (cookie, path, init = {}) => fetch(B + path, { ...init, headers: { cookie, "content-type": "application/json", ...(init.headers ?? {}) } });
export async function upload(cookie, file, dir = DIR) {
  const buf = fs.readFileSync(dir + file), r = await api(cookie, "/api/vault", { method: "POST", body: JSON.stringify({ name: file, size: buf.length }) }), j = await r.json();
  if (!r.ok) return { status: r.status, error: j.error };
  const fd = new FormData(); fd.append("cacheControl", "3600"); fd.append("", new Blob([buf], { type: MIME[file.split(".").pop()] ?? "application/octet-stream" }), file);
  const put = await fetch(j.uploadUrl, { method: "PUT", body: fd, headers: { "x-upsert": "false" } });
  return { id: j.id, put: put.status };
}
/** Calls /process until the document is Ready or Can't read, like the Vault page does; `onWaiting` can decide to stop early. */
export async function settle(cookie, id, { maxSteps = 200, stopOnWaiting = false } = {}) {
  const t0 = Date.now(), seen = new Set();
  for (let steps = 0; steps < maxSteps; steps++) {
    const r = await api(cookie, `/api/vault/${id}/process`, { method: "POST" }), j = await r.json();
    if (r.status === 404) return { state: "gone", steps };
    seen.add(j.state);
    if (["ready", "unreadable", "gone"].includes(j.state) || (stopOnWaiting && j.state === "waiting")) return { ...j, steps, secs: Math.round((Date.now() - t0) / 1000), seen: [...seen] };
    await sleep(Math.min(j.waitMs || 800, 25000));
  }
  return { state: "timeout", seen: [...seen] };
}
const words = (s) => s.toLowerCase().normalize("NFKC").match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
/** Share of the original's words that appear in the reading (as a bag of words). */
export function recall(original, reading) {
  const have = new Map(); for (const w of words(reading)) have.set(w, (have.get(w) ?? 0) + 1);
  const o = words(original); let hit = 0; for (const w of o) { const n = have.get(w) ?? 0; if (n > 0) { hit++; have.set(w, n - 1); } }
  return o.length ? hit / o.length : 1;
}
if (process.argv[1]?.endsWith("scan-test.mjs")) {
  const A = await login(), files = process.argv.slice(2).length ? process.argv.slice(2) : ["scan-clean-nda.pdf", "scan-skewed-lowquality-nda.pdf", "mixed-text-and-scan.pdf", "scan-hindi.pdf", "photo-page.jpg"];
  const orig = { "scan-clean-nda.pdf": "nda-original.txt", "scan-skewed-lowquality-nda.pdf": "nda-original.txt", "scan-hindi.pdf": "scan-hindi-original.txt", "photo-page.jpg": null, "mixed-text-and-scan.pdf": null };
  console.log("file | state | seconds | pages (scan read/total) | passages | word recall | page markers");
  for (const f of files) {
    const u = await upload(A, f); if (!u.id) { console.log(`${f} | refused ${u.status}: ${u.error}`); continue; }
    const s = await settle(A, u.id), d = (await (await api(A, `/api/vault/${u.id}`)).json());
    const text = d.text ?? "", o = orig[f] ? fs.readFileSync(DIR + orig[f], "utf8") : null;
    console.log([f, s.state === "unreadable" ? `unreadable: ${s.message}` : s.state, s.secs, `${d.doc.pages ?? "?"} (${d.doc.scanPages}/${d.doc.scanTotal}${d.doc.scanSkipped ? `, ${d.doc.scanSkipped} skipped` : ""})`, d.doc.chunkCount, o ? `${(100 * recall(o, text)).toFixed(1)}%` : "-", `scan pages ${JSON.stringify(d.scanPages)}`].join(" | "));
    if (process.env.SHOW) console.log(text.slice(0, 700), "\n----");
  }
}
