// Every icon and metadata image comes from ONE place (scripts/reskin/make-icons.mjs, fed by src/styles/tokens.css and src/lib/brand.ts) and carries the current pilcrow logo. Found Oct 31: the logo files in public/brand
// were still the old leaf, the tab icon was only an SVG redirected from /favicon.ico (Safari shows no SVG tab icon, so it keeps its old cached one), and there was no apple-touch icon, manifest or share image at all.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { PUBLIC_ASSETS, isPublicPath, isStaticPath } from "./access/token.mjs";
import { MARK } from "./brand.ts";
import { REDIRECTS } from "../config/redirects.mjs";

const tokens = fs.readFileSync("src/styles/tokens.css", "utf8"), tok = (n) => new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`).exec(tokens)[1].toLowerCase();
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));

test("the generator confirms every icon and logo file is in step with the tokens and the logo", () => {
  execFileSync("node", ["scripts/reskin/make-icons.mjs", "--check"], { stdio: "pipe" });
});
test("no SVG, icon or brand file carries the old leaf logo or its colours (public/brand, src/app)", () => {
  const files = [...walk("public/brand"), ...walk("public/icons"), ...walk("src/app").filter((f) => /\.(svg|webmanifest)$/.test(f))];
  assert.ok(files.length >= 9);
  for (const f of files.filter((x) => /\.(svg|webmanifest)$/.test(x))) {
    const t = fs.readFileSync(f, "utf8");
    assert.ok(!/M24 2C10 4 3 14|M25 5C11 7|#6e3730|#f2f1ee|#1e1b17/i.test(t), `${f} still has the old leaf look`);
    if (f.endsWith(".svg")) assert.ok(t.includes(MARK.paths[0]) || t.includes("M30.94"), `${f} does not carry the pilcrow mark`);
  }
});
test("the tab icon and its colours are the tokens', in the committed files", () => {
  const svg = fs.readFileSync("src/app/icon.svg", "utf8").toLowerCase();
  assert.ok(svg.includes(tok("primary")) && svg.includes(tok("background")));
  const m = JSON.parse(fs.readFileSync("src/app/manifest.webmanifest", "utf8"));
  assert.equal(m.theme_color.toLowerCase(), tok("primary")); assert.equal(m.background_color.toLowerCase(), tok("background"));
  assert.equal(JSON.parse(fs.readFileSync("src/config/brand-meta.json", "utf8")).themeColor.toLowerCase(), tok("primary"));
  for (const i of m.icons) assert.ok(fs.existsSync(`public${i.src}`), i.src);
});
test("a real .ico (16, 32, 48 px) and the image sizes browsers, iPhones and link previews ask for exist", () => {
  const ico = fs.readFileSync("src/app/favicon.ico"); assert.equal(ico.readUInt16LE(2), 1); assert.deepEqual([...Array(ico.readUInt16LE(4))].map((_, i) => ico[6 + 16 * i]), [16, 32, 48]);
  const dim = (f) => { const b = fs.readFileSync(f); assert.equal(b.toString("latin1", 1, 4), "PNG", f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  assert.deepEqual(dim("src/app/apple-icon.png"), [180, 180]); assert.deepEqual(dim("src/app/opengraph-image.png"), [1200, 630]); assert.deepEqual(dim("src/app/twitter-image.png"), [1200, 630]);
  assert.deepEqual(dim("public/icons/icon-192.png"), [192, 192]); assert.deepEqual(dim("public/icons/icon-512.png"), [512, 512]); assert.deepEqual(dim("public/icons/icon-maskable-512.png"), [512, 512]);
});
test("class: the icon, manifest and share-image URLs are reachable without the password, and no layout or route lists icons of its own", () => {
  for (const p of PUBLIC_ASSETS) { assert.equal(isPublicPath(p), true, p); assert.equal(isStaticPath(p), true, p); }
  for (const p of ["/favicon.ico", "/icon.svg", "/apple-icon.png", "/opengraph-image.png", "/twitter-image.png", "/manifest.webmanifest", "/icons/icon-192.png"]) assert.equal(isPublicPath(p), true, p);
  assert.equal(isPublicPath("/library"), false);
  const layout = fs.readFileSync("src/app/layout.tsx", "utf8");
  assert.ok(!/\bicons\s*:/.test(layout), "the layout must not list icons: Next reads them from the generated files");
  assert.ok(!fs.existsSync("src/app/favicon.ico/route.ts"), "/favicon.ico is a real .ico file, not a redirect to the SVG");
  const stray = walk("src").filter((f) => /\.(tsx?|mjs)$/.test(f) && !/\.test\./.test(f)).filter((f) => /rel=["']icon["']|apple-touch-icon|link rel="manifest"/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(stray, []);
});
test("class: no icon, manifest or share-image URL is swallowed by a redirect (the old /brand/* files were never reachable: /brand redirects to the home page)", () => {
  const urls = [...PUBLIC_ASSETS.filter((u) => u !== "/robots.txt"), ...JSON.parse(fs.readFileSync("src/app/manifest.webmanifest", "utf8")).icons.map((i) => i.src)];
  for (const u of urls) for (const r of REDIRECTS) { const base = r.source.replace(/\/:[^/]+\*?$/, ""); assert.ok(!(u === base || u.startsWith(`${base}/`)) || r.has, `${u} is redirected by ${r.source}`); }
});
