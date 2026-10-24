// One tiny call per task (and per distinct model) in src/config/ai-models.json, to confirm the API key works. Reads .env.local; prints task, model, ok/error kind and seconds. NEVER prints a key.
// usage: node scripts/ai/key-check.mjs
import fs from "node:fs";
import { completeTask } from "../../src/lib/ai/run.mjs";
for (const l of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const config = JSON.parse(fs.readFileSync("src/config/ai-models.json", "utf8")), env = process.env;
const rows = []; let bad = 0;
async function ping(label, cfg, task) {
  const t0 = Date.now();
  try {
    const r = await completeTask(task, { messages: [{ role: "user", content: "Reply with the single word: ok" }], maxOutputTokens: 40, ...(cfg.tasks[task].json ? { json: false } : {}) }, { config: cfg, env, fetchImpl: fetch });
    rows.push([label, r.model, /ok/i.test(r.text) ? "OK" : `answered (${r.text.slice(0, 20)})`, ((Date.now() - t0) / 1000).toFixed(1) + "s"]);
  } catch (e) { bad++; rows.push([label, "-", `FAILED: ${e?.kind ?? e?.name ?? "error"}`, ((Date.now() - t0) / 1000).toFixed(1) + "s"]); }
}
// each task on its own primary model, with no fallback so a failure is not hidden
for (const task of Object.keys(config.tasks)) {
  const cfg = JSON.parse(JSON.stringify(config)); cfg.tasks[task].fallback = []; cfg.tasks[task].firstTokenMs = 0;
  await ping(`task ${task}`, cfg, task);
}
// each distinct fallback model, once
const models = new Set(Object.values(config.tasks).flatMap((t) => t.fallback ?? []));
for (const m of models) { const cfg = JSON.parse(JSON.stringify(config)); cfg.tasks.chat = { ...cfg.tasks.chat, model: m, fallback: [], firstTokenMs: 0 }; await ping(`fallback model ${m}`, cfg, "chat"); }
for (const r of rows) console.log(r.join(" | "));
console.log(bad ? `${bad} failed` : "all calls worked");
process.exit(bad ? 1 : 0);
