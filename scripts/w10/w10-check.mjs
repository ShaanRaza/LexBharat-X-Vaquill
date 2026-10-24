// W10 checks against a running dev server. usage: TEST_PW=<throwaway access pw> node scripts/w10/w10-check.mjs
const B = process.env.BASE ?? "http://localhost:3100", PW = process.env.TEST_PW;
const rows = []; const ok = (area, name, pass, detail = "") => { rows.push([area, name, pass]); console.log(`${pass ? "PASS" : "FAIL"} | ${area} | ${name}${detail ? " | " + detail : ""}`); };
const login = await fetch(B + "/api/access/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: PW }) });
const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const get = (p) => fetch(B + p, { headers: { cookie }, redirect: "manual" });
const page = async (p) => { const r = await get(p); return { status: r.status, html: await r.text() }; };
const text = (h) => h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, " ");
ok("Gate", "login works", login.status === 200);

// 1 status
let p = await page("/workspace/browse/acts/IND_state_6796"); let t = text(p.html);
ok("Status", "CrPC page shows Repealed", p.status === 200 && /Repealed/.test(t) && /Repealed — see BNSS/.test(t));
p = await page("/workspace/browse/acts/IND_state_8322"); t = text(p.html);
ok("Status", "Minimum Wages Act (the in-force twin) now shows Repealed — see Code on Wages", /Repealed/.test(t) && /Code on Wages/.test(t));
const l = await (await get("/api/acts/list?search=minimum+wages+act&status=in_force&category=central")).json().catch(() => null);
ok("Status", "the Acts list no longer lists the Minimum Wages Act 1948 as in force (central)", !!l && !(l.results ?? []).some((a) => /^The MINIMUM WAGES ACT, 1948$/i.test(a.title) && a.actStatus === "in_force"), l ? `${(l.results ?? []).length} in-force hits` : "no list");

// 3 appendices
const sr = async (q, extra = "") => (await (await get(`/api/acts/search?q=${encodeURIComponent(q)}${extra}`)).json());
let s = await sr("Appendix II Constitution of India");
ok("Appendices", "'Appendix II Constitution of India' finds the 2019 Order", s.searchAvailable && s.results?.[0]?.number === "APP2", s.results?.[0]?.heading ?? "");
p = await page("/workspace/browse/acts/IND_central_COI?section=sAPP3"); t = text(p.html);
ok("Appendices", "Appendix III page shows the Article 370(3) declaration", /Appendix III/.test(t) && /370/.test(t) && /C\.O\. 273/.test(t));
p = await page("/workspace/browse/acts/IND_central_COI?section=sAPP1"); t = text(p.html);
ok("Appendices", "Appendix I page shows the 100th Amendment Act", /ONE HUNDREDTH AMENDMENT/i.test(t) && /Bangladesh/.test(t));

// 5 SC duplicate notice
p = await page("/workspace/browse/judgments/supreme-court-of-india/1979/1979_INSC_254"); t = text(p.html);
ok("SC", "duplicate record shows the 'same judgment' notice", /Probably the same judgment/.test(t) && /1979_INSC_253/.test(t), `status ${p.status}`);

// 6 regulator listings
const lc = await (await get("/api/acts/list?search=report+no.+41&category=regulatory")).json().catch(() => null);
ok("Regulators", "Law Commission reports are listed with readable titles", !!lc && (lc.results ?? []).some((a) => /^Law Commission of India, Report No\./.test(a.title)), lc ? `${lc.total} matches` : "");
const dgft = await sr("export import policy", "&scope=regulators");
ok("Regulators", "regulator keyword search answers", dgft.searchAvailable && dgft.results.length > 0, `${dgft.total} hits, first: ${dgft.results?.[0]?.actTitle ?? "-"}`);
const sem = await sr("What does the DGFT say about export licences for restricted items?", "&scope=regulators");
ok("Regulators", "regulator search by meaning answers (loaded subset: DGFT, CBIC, small tribunals)", sem.searchAvailable && sem.mode === "semantic" && sem.results.length > 0, `mode ${sem.mode}, first: ${sem.results?.[0]?.actTitle ?? "-"} / ${sem.results?.[0]?.department ?? "-"}`);
if (dgft.results?.[0]) { const h = dgft.results[0]; p = await page(`/workspace/browse/acts/${h.actId}?section=${encodeURIComponent(h.sectionKey)}`); t = text(p.html);
  ok("Regulators", "a regulator section page shows its text", p.status === 200 && t.length > 800 && !/not (available|included)/i.test(t.slice(0, 3000)), `${t.length} chars`); }

const hi = await sr("असाधारण");
ok("Hindi", "Devanagari query finds sections with shown Hindi text", hi.searchAvailable && hi.results.length > 0, `${hi.total} hits`);
console.log(`\n${rows.filter((r) => r[2]).length} of ${rows.length} passed`);
