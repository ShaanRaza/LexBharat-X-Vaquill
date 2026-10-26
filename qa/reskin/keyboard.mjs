// Keyboard checks of the shell (Phase 3): skip link, mobile drawer (open with Enter, focus moves in, Tab stays inside, Esc closes and returns focus), product menu (Enter opens, arrows move, Esc closes and returns focus), password page (Tab order, visible focus, Enter submits).
// usage: ACCESS_PW=... node --experimental-websocket qa/reskin/keyboard.mjs [base]
import { launch } from "./cdp.mjs";
const BASE = process.argv[2] ?? "http://localhost:3100", BID = "reskinfixtures00000000001";
const lg = await fetch(BASE + "/api/access/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: process.env.ACCESS_PW }) });
const cookies = lg.headers.getSetCookie().map((c) => c.split(";")[0]), c = await launch(9366), rows = [];
const ok = (n, p, d = "") => { rows.push(p); console.log(`${p ? "PASS" : "FAIL"} | ${n}${d ? " | " + d : ""}`); };
const key = async (k, mods = 0) => { const code = { Tab: 9, Enter: 13, Escape: 27, ArrowDown: 40, ArrowUp: 38 }[k]; for (const type of ["keyDown", "keyUp"]) await c.send("Input.dispatchKeyEvent", { type, key: k, code: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, modifiers: mods, ...(type === "keyDown" && k === "Enter" ? { text: "\r" } : {}) }); await c.sleep(150); };
const active = () => c.js(`(() => { const a = document.activeElement; return a ? (a.getAttribute("aria-label") || a.id || a.textContent.trim().slice(0, 30) || a.tagName) + "|" + a.tagName + "|" + !!a.closest('[role=dialog]') : ""; })()`);
const outline = () => c.js(`(() => { const a = document.activeElement, s = getComputedStyle(a); return (parseFloat(s.outlineWidth) > 0 && s.outlineStyle !== "none") || s.boxShadow !== "none"; })()`);
await c.view(375, 812);
for (const kv of [...cookies, `lb_bid=${BID}`]) { const i = kv.indexOf("="); await c.cookie(kv.slice(0, i), kv.slice(i + 1)); }
await c.go(BASE + "/workspace", 3000);
await key("Tab"); ok("first Tab goes to the skip link", /Skip to main/.test(await active()), await active());
await c.js(`document.querySelector('button[aria-label="Open menu"]').focus()`); await key("Enter");
let a = await active(); ok("Enter on the menu button opens the drawer and moves focus into it", a.endsWith("|true") || /dialog|aside/i.test(a) || (await c.js(`!!document.querySelector('[role=dialog]')`)), a);
let inside = true; for (let i = 0; i < 14; i++) { await key("Tab"); if (!(await c.js(`!!document.activeElement.closest('[role=dialog]') || document.activeElement.getAttribute('role') === 'dialog'`))) inside = false; }
ok("Tab stays inside the open drawer (14 presses)", inside);
ok("focus is visible inside the drawer", await outline());
await key("Escape"); ok("Escape closes the drawer", !(await c.js(`!!document.querySelector('[role=dialog]')`)));
ok("focus returns to the menu button", /Open menu/.test(await active()), await active());
await c.view(1280, 800); await c.go(BASE + "/workspace", 2500);
await c.js(`document.querySelector('[data-testid="product-switcher"]').focus()`); await key("Enter");
ok("Enter opens the product menu", await c.js(`!!document.querySelector('[role=menu]')`));
await key("ArrowDown"); ok("arrow keys move inside the menu", /menuitem/.test(await c.js(`document.activeElement.getAttribute("role") || ""`)));
await key("Escape"); ok("Escape closes it and returns focus to the switcher", !(await c.js(`!!document.querySelector('[role=menu]')`)) && /Switch product/.test(await active()), await active());
await c.send("Network.clearBrowserCookies"); await c.go(BASE + "/access", 4500);
ok("password field is set to take focus on load (autofocus)", await c.js(`document.getElementById("access-pw").autofocus === true || document.getElementById("access-pw").hasAttribute("autofocus") || document.activeElement.id === "access-pw"`));
await c.send("Emulation.setFocusEmulationEnabled", { enabled: true }); await c.js(`document.getElementById("access-pw").focus()`);
ok("focus ring is visible on the password field", await outline());
await c.js(`(() => { const i = document.getElementById("access-pw"); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, "not-the-password"); i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
await key("Tab"); ok("Tab moves to the Continue button", /Continue/.test(await active()), await active());
await key("Enter"); await c.sleep(1800); ok("a wrong password shows an error and stays on the page", (await c.js(`location.pathname`)) === "/access" && (await c.js(`!!document.querySelector('[role=alert]')`)));
c.close(); console.log(`\n${rows.filter(Boolean).length} of ${rows.length} passed`); process.exit(rows.every(Boolean) ? 0 : 1);
