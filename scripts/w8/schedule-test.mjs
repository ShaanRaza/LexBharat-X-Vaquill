// Part 0 tests against a running dev server: lookups of Orders/Rules/Articles, keyword + meaning search, and chat. usage: TEST_PW=<pw> node scripts/w8/schedule-test.mjs
import { api, login } from "./scan-test.mjs";
const A = await login(), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const search = async (q, extra = "") => (await (await api(A, `/api/acts/search?q=${encodeURIComponent(q)}${extra}`)).json());
const row = (h) => `${h.actTitle.replace(/^The /, "").slice(0, 28)} · ${h.number} · ${(h.heading ?? "").slice(0, 60)}`;
console.log("## Lookups (keyword search; the first result must be the unit asked for)");
const LOOK = [["Order 39 Rule 1 CPC", "O39R1"], ["O.7 R.11", "O7R11"], ["O 37 CPC", "O37"], ["Article 137 Limitation Act", "A137"], ["Art. 113 Limitation", "A113"], ["Order 21 Rule 32 CPC", "O21R32"], ["Order 6 Rule 17 CPC", "O6R17"], ["Order 1 Rule 10", "O1R10"], ["Article 54 Limitation Act", "A54"], ["Art 62 Limitation Act", "A62"], ["Article 5 Stamp Act", "A5"], ["Order 39 Rules 1-2 CPC", "O39R1"]];
let pass = 0;
for (const [q, want] of LOOK) { const r = await search(q), h = r.results?.[0], ok = h?.number === want; pass += ok; console.log(`${ok ? "PASS" : "FAIL"} | ${q.padEnd(28)} | ${r.mode} | ${h ? row(h) : "no result"}${r.results?.length > 1 ? ` (+${r.results.length - 1} more)` : ""}`); await sleep(400); }
console.log(`${pass}/${LOOK.length} lookups found the right unit first`);
console.log("\n## Meaning search");
for (const q of ["Rejection of plaint on the ground that the suit is barred by law", "temporary injunction under CPC", "limitation period for a suit for recovery of money"]) { const r = await search(q); console.log(`"${q}" [${r.mode}]\n` + r.results.slice(0, 6).map((h, i) => `   ${i + 1}. ${row(h)}`).join("\n")); await sleep(600); }
console.log("\n## Chat");
for (const q of ["What is Order 7 Rule 11?", "Limitation period for a suit for recovery of money", "Temporary injunction under CPC"]) {
  const res = await api(A, "/api/chat", { method: "POST", body: JSON.stringify({ message: q }) }), ev = (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const src = ev.find((e) => e.type === "sources")?.sources ?? [], ans = ev.filter((e) => e.type === "delta").map((e) => e.text).join(""), chk = ev.find((e) => e.type === "check"), err = ev.find((e) => e.type === "error");
  console.log(`\nQ: ${q}\n   ${err ? "ERROR " + err.message : "check: " + chk?.label}\n   sources: ${src.map((s) => `[${s.n}] ${s.actTitle.replace(/^The /, "").slice(0, 22)} ${s.number ?? ""}`).join("; ")}\n   answer: ${ans.replace(/\s+/g, " ").slice(0, 380)}`);
  await sleep(2500);
}
