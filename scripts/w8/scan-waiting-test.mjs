// "Waiting to read" and resume. Needs the dev server started against a stub reading model that answers 429 while /tmp/w8-stub-busy exists (see docs/W8-SCANS-FEEDBACK.md). usage: TEST_PW=<pw> node scripts/w8/scan-waiting-test.mjs
import fs from "node:fs";
import { api, login, settle, upload } from "./scan-test.mjs";
const A = await login(); fs.writeFileSync("/tmp/w8-stub-busy", "");
const u = await upload(A, "photo-page.jpg"), s1 = await settle(A, u.id, { stopOnWaiting: true });
const l1 = (await (await api(A, "/api/vault")).json()).docs.find((d) => d.id === u.id);
console.log("1. model busy -> step state:", s1.state, "| list status:", l1.status, "| detail:", l1.statusDetail);
const again = await (await api(A, `/api/vault/${u.id}/process`, { method: "POST" })).json(); console.log("   asked again while still busy ->", again.state, "| status stays waiting:", (await (await api(A, `/api/vault/${u.id}`)).json()).doc.status);
fs.rmSync("/tmp/w8-stub-busy"); console.log("2. model free again; resuming...");
const s2 = await settle(A, u.id), d = await (await api(A, `/api/vault/${u.id}`)).json();
console.log("   final state:", s2.state, "| scanned:", d.doc.scanned, "| text:", JSON.stringify((d.text ?? "").slice(0, 60)), "| scan pages:", JSON.stringify(d.scanPages));
