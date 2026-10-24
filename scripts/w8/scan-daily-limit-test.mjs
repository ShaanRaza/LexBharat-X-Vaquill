// The 5-scanned-documents-a-day limit: one fresh browser adds 6 pictures; the first 5 start reading, the 6th is refused with a clear message. usage: TEST_PW=<pw> node scripts/w8/scan-daily-limit-test.mjs
import { api, login, upload } from "./scan-test.mjs";
const A = await login(); let lastMsg = "";
for (let i = 1; i <= 6; i++) {
  const u = await upload(A, "photo-page.jpg"); if (!u.id) { console.log(`#${i}: upload refused: ${u.error}`); continue; }
  const r = await (await api(A, `/api/vault/${u.id}/process`, { method: "POST" })).json();
  console.log(`#${i}: first step -> ${r.state}${r.state === "unreadable" ? `: ${r.message}` : ""}`); lastMsg = r.message ?? "";
}
const list = await (await api(A, "/api/vault")).json();
console.log("statuses:", list.docs.map((d) => d.status).join(", "));
