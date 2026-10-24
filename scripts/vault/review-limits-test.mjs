// Review limits and isolation (no model calls): the 6th review of a day is refused, and another browser cannot read, step, export or delete someone's review. usage: TEST_PW=... node scripts/vault/review-limits-test.mjs
import fs from "node:fs";
const B = "http://localhost:3100", DIR = "../lexbharat-data/w6-test-files/", sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const login = async () => (await fetch(B + "/api/access/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: process.env.TEST_PW }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const rows = []; const ok = (n, p, d = "") => { rows.push([n, p ? "PASS" : "FAIL", d]); console.log(`${p ? "PASS" : "FAIL"} | ${n}${d ? " | " + d : ""}`); };
const A = await login(), O = await login(), api = (c, p, i = {}) => fetch(B + p, { ...i, headers: { cookie: c, "content-type": "application/json" } });
const buf = fs.readFileSync(DIR + "notes.txt"), up = await (await api(A, "/api/vault", { method: "POST", body: JSON.stringify({ name: "limit-notes.txt", size: buf.length }) })).json();
const fd = new FormData(); fd.append("cacheControl", "3600"); fd.append("", new Blob([buf], { type: "text/plain" }), "n.txt"); await fetch(up.uploadUrl, { method: "PUT", body: fd, headers: { "x-upsert": "false" } });
for (let i = 0; i < 20; i++) { const j = await (await api(A, `/api/vault/${up.id}/process`, { method: "POST" })).json(); if (j.state === "ready") break; await sleep(Math.min(j.waitMs || 1000, 25000)); }
const start = (c, body) => api(c, "/api/review", { method: "POST", body: JSON.stringify(body) });
const good = { docId: up.id, contractType: "nda", side: "Receiving party" }, ids = [];
for (let i = 0; i < 5; i++) { const r = await start(A, good), j = await r.json(); if (r.ok) ids.push(j.id); }
ok("five reviews are accepted in a day", ids.length === 5);
const sixth = await start(A, good), sj = await sixth.json(); ok("the sixth is refused with the daily-limit message", sixth.status === 429 && /today's limit of 5 reviews/.test(sj.error), sj.error);
const list = await (await api(A, "/api/review")).json(); ok("usage shows 5 of 5 used", list.usage.day === 5 && list.limits.daily === 5, JSON.stringify(list.usage));
const del = await api(A, `/api/review/${ids[0]}`, { method: "DELETE" }); const again = await start(A, good);
ok("deleting a review does not give the allowance back", del.status === 200 && again.status === 429);
for (const [n, p, i] of [["read", `/api/review/${ids[1]}`, {}], ["step", `/api/review/${ids[1]}/step`, { method: "POST", body: "{}" }], ["export", `/api/review/${ids[1]}/export?format=pdf`, {}], ["delete", `/api/review/${ids[1]}`, { method: "DELETE" }]]) {
  const r = await api(O, p, i); ok(`another browser cannot ${n} the review`, r.status === 404, String(r.status));
}
const ol = await (await api(O, "/api/review")).json(); ok("another browser's review list is empty", ol.reviews.length === 0);
const od = await start(O, good); ok("another browser cannot review my document", od.status === 404, String(od.status));
const bad = await start(A, { ...good, side: "Landlord / licensor" }); ok("a side that does not belong to the type is refused", bad.status === 422 || bad.status === 429);
for (const id of ids.slice(1)) await api(A, `/api/review/${id}`, { method: "DELETE" });
await api(A, `/api/vault/${up.id}`, { method: "DELETE" });
fs.writeFileSync("/tmp/w6-review-limits.json", JSON.stringify(rows)); console.log(`${rows.filter((r) => r[1] === "PASS").length}/${rows.length} passed`);
