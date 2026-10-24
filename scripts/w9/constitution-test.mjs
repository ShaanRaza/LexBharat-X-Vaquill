// Constitution lookups, meaning search, chat and the Act page against a running dev server. usage: TEST_PW=<pw> node scripts/w9/constitution-test.mjs
import { api, login } from "../w8/scan-test.mjs";
const A = await login(), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
console.log("## Lookups");
for (const [q, want] of [["Article 21", "A21"], ["Art. 226 Constitution", "A226"], ["Article 32", "A32"], ["Art 14", "A14"], ["Article 21A", "A21A"], ["Seventh Schedule", "S7"], ["Article 243ZH of the Constitution", "A243ZH"], ["Article 370", "A370"]]) {
  const r = await (await api(A, `/api/acts/search?q=${encodeURIComponent(q)}`)).json(), h = r.results?.[0];
  console.log(`${h?.number === want && /Constitution of India/.test(h?.actTitle ?? "") ? "PASS" : "FAIL"} | ${q.padEnd(34)} | ${r.mode} | ${h ? `${h.actTitle.slice(0, 26)} · ${h.number} · ${(h.heading ?? "").slice(0, 60)}` : "no result"}`); await sleep(400);
}
console.log("\n## Meaning search");
for (const q of ["right to life and personal liberty", "power of the High Court to issue writs", "emergency provisions suspension of fundamental rights", "reservation of seats for women in Parliament"]) { const r = await (await api(A, `/api/acts/search?q=${encodeURIComponent(q)}`)).json(); console.log(`"${q}" [${r.mode}]\n` + r.results.slice(0, 4).map((h, i) => `   ${i + 1}. ${h.actTitle.replace(/^The /, "").slice(0, 28)} · ${h.number} · ${(h.heading ?? "").slice(0, 50)}`).join("\n")); await sleep(600); }
console.log("\n## Chat");
for (const q of ["What does Article 21 say?", "What does Article 21A provide?", "Which article gives the Supreme Court power to issue writs?"]) {
  let ev, err; for (let t = 0; t < 3; t++) { ev = (await (await api(A, "/api/chat", { method: "POST", body: JSON.stringify({ message: q }) })).text()).split("\n").filter(Boolean).map((l) => JSON.parse(l)); err = ev.find((e) => e.type === "error"); if (!err || err.code !== "busy") break; await sleep(65000); }
  const src = ev.find((e) => e.type === "sources")?.sources ?? [], chk = ev.find((e) => e.type === "check");
  console.log(`\nQ: ${q}\n   ${err ? "ERROR " + err.message : "check: " + chk?.label} | ${src.length} sources: ${src.map((s) => `[${s.n}] ${s.actTitle.replace(/^The /, "").slice(0, 22)} ${s.number ?? ""}`).join("; ")}\n   answer: ${ev.filter((e) => e.type === "delta").map((e) => e.text).join("").replace(/\s+/g, " ").slice(0, 330)}`); await sleep(2500);
}
