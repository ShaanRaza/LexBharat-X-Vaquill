// QA harness: drives headless Chrome over the DevTools Protocol using only Node built-ins (no installs).
// For every route x breakpoint it: emulates the device, loads the page, scrolls it (so scroll-reveals fire),
// runs an in-page DOM audit, records console / exception / network problems, and saves a full-page JPEG.
//
//   node qa/cdp-audit.mjs desktop mobile tablet [--routes qa/routes.txt] [--conc 4] [--only /a,/b]
//
// Output: qa/screenshots/<bp>/<slug>.jpg and qa/logs/cdp-<bp>.json
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const BASE = 'http://localhost:3100';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const BPS = { desktop: { w: 1280, h: 900, mobile: false }, tablet: { w: 820, h: 1100, mobile: false }, mobile: { w: 390, h: 844, mobile: true } };

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const bpNames = argv.filter((a) => BPS[a]);
const routesFile = opt('--routes', 'qa/routes.txt');
const conc = Number(opt('--conc', '4'));
const only = opt('--only', '');
const OUT = opt('--out', 'qa'); // output root: <OUT>/screenshots/<bp>, <OUT>/logs/cdp-<bp>.json
let routes = fs.readFileSync(routesFile, 'utf8').split('\n').filter(Boolean);
if (only) routes = only.split(',');

const NOISE = /React DevTools|Fast Refresh|\[HMR\]|hot-reloader|webpack-hmr/i;
const slugOf = (r) => (r === '/' ? 'home' : r.replace(/^\//, '').replace(/\//g, '__'));

// ── minimal CDP client ────────────────────────────────────────────────────────
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id) { const p = this.pending.get(m.id); if (p) { this.pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } }
      else if (m.method) { const h = this.handlers.get(m.sessionId || ''); if (h) h(m); }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params, sessionId })); });
  }
  on(sessionId, fn) { this.handlers.set(sessionId, fn); }
}

// ── in-page audit (runs inside the page; returns an array of issue strings) ───
const AUDIT = `(() => {
  const out = [], W = window.innerWidth;
  const sel = (e) => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '')).slice(0, 60);
  const add = (k, v) => out.push(k + (v ? ': ' + v : ''));
  const root = document.documentElement;
  if (root.scrollWidth > W + 1) add('H-OVERFLOW', root.scrollWidth + 'px > ' + W + 'px');
  const inScroller = (e) => { for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
  const off = [...document.body.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(), cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && (b.right > W + 1 || b.left < -1) && cs.position !== 'fixed' && cs.position !== 'absolute' && !inScroller(e); });
  if (off.length) add('OFFSCREEN', off.length + ' e.g. ' + off.slice(0, 2).map(sel).join(' | '));
  const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0); if (broken.length) add('BROKEN-IMG', broken.length);
  const noalt = [...document.images].filter((i) => !i.hasAttribute('alt')); if (noalt.length) add('IMG-NO-ALT', noalt.length);
  const clipped = [...document.body.querySelectorAll('h1,h2,h3,p,li,a,button,label,span')].filter((e) => { const cs = getComputedStyle(e); return (cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis') && e.scrollWidth > e.clientWidth + 2 && e.textContent.trim() && !e.closest('pre,table') && !/sr-only/.test(e.className); });
  if (clipped.length) add('CLIPPED-TEXT', clipped.slice(0, 2).map(sel).join(' | '));
  const small = [...document.body.querySelectorAll('button,input:not([type=hidden]),select,textarea,a')].filter((e) => { const b = e.getBoundingClientRect(), cs = getComputedStyle(e); if (!b.width || cs.visibility === 'hidden' || e.classList.contains('sr-only')) return false; if (cs.display === 'inline' && e.closest('p,li,dd,dt,h1,h2,h3,td,label,figcaption,div.text-center')) return false; return b.height < 24 || b.width < 24; });
  if (small.length) add('SMALL-TARGET(<24px)', small.length + ' e.g. ' + small.slice(0, 2).map(sel).join(' | '));
  const h1s = document.querySelectorAll('h1'); if (h1s.length !== 1) add('H1-COUNT', h1s.length);
  if (document.querySelectorAll('main').length !== 1) add('MAIN-COUNT', document.querySelectorAll('main').length);
  if (!document.querySelector('a[href="#main"]')) add('NO-SKIP-LINK');
  const nav = document.querySelector('nav[aria-label="Main"]'), h1 = h1s[0];
  if (nav && h1) { const a = h1.getBoundingClientRect(), b = nav.getBoundingClientRect(); if (a.top < b.bottom + 4 && a.bottom > b.top) add('NAV-OVERLAPS-H1'); }
  const stuck = [...document.querySelectorAll('.reveal-hidden:not(.in)')].filter((e) => { const b = e.getBoundingClientRect(); return b.top < window.innerHeight && b.bottom > 0; });
  if (stuck.length) add('REVEAL-STUCK-IN-VIEW', stuck.length);
  const leaves = [...document.body.querySelectorAll('h1,h2,h3,p,li,label,button,a')].filter((e) => !e.querySelector('h1,h2,h3,p,li,label,button,a') && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden' && e.textContent.trim()).slice(0, 450);
  const R = leaves.map((e) => [e, e.getBoundingClientRect()]); let ov = 0, ex = '';
  for (let i = 0; i < R.length && !ov; i++) for (let j = i + 1; j < R.length; j++) { const [ea, a] = R[i], [eb, b] = R[j]; if (ea.contains(eb) || eb.contains(ea)) continue; if (ea.closest('p,li,dd') && ea.closest('p,li,dd') === eb.closest('p,li,dd') && getComputedStyle(ea).display === 'inline' && getComputedStyle(eb).display === 'inline') continue; const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (ix > 4 && iy > 4 && ix * iy > 0.25 * Math.min(a.width * a.height, b.width * b.height)) { ov = 1; ex = sel(ea) + ' x ' + sel(eb); break; } }
  if (ov) add('TEXT-OVERLAP', ex);
  // contrast (flat backgrounds only)
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const blend = (f, b) => [0, 1, 2].map((i) => f[3] * f[i] + (1 - f[3]) * b[i]).concat([1]);
  const bgOf = (e) => { let stack = []; for (let p = e; p; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.backgroundImage !== 'none') return null; const c = parse(cs.backgroundColor); if (c && c[3] > 0) { stack.push(c); if (c[3] >= 0.99) break; } } let base = [242, 241, 238, 1]; for (let i = stack.length - 1; i >= 0; i--) base = blend(stack[i], base); return base; };
  const low = [];
  for (const e of leaves.slice(0, 250)) {
    const cs = getComputedStyle(e); const fg = parse(cs.color); if (!fg) continue; const bg = bgOf(e); if (!bg) continue;
    let op = 1; for (let p = e; p; p = p.parentElement) op *= Number(getComputedStyle(p).opacity); if (op < 0.99) continue;
    const f = blend([fg[0], fg[1], fg[2], fg[3] * op], bg); const L1 = lum(f), L2 = lum(bg); const r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700, large = px >= 24 || (px >= 18.66 && bold);
    if (r < (large ? 3 : 4.5) && !e.disabled && e.getAttribute('aria-disabled') !== 'true') low.push(sel(e) + ' ' + r.toFixed(2));
  }
  if (low.length) add('LOW-CONTRAST', low.length + ' e.g. ' + low.slice(0, 2).join(' | '));
  return out;
})()`;

const SCROLL = `(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += Math.max(400, innerHeight * 0.8)) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 70)); } window.scrollTo(0, h); await new Promise((r) => setTimeout(r, 200)); window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 1200)); return document.documentElement.scrollHeight; })()`;

// ── run ───────────────────────────────────────────────────────────────────────
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/qa-cdp-profile', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill(); } catch {} };
process.on('exit', cleanup); process.on('SIGINT', () => { cleanup(); process.exit(1); });

let ver;
for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await new Promise((r) => setTimeout(r, 200)); } }
if (!ver) { console.error('Chrome did not start'); process.exit(2); }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
const cdp = new CDP(ws);

async function runBreakpoint(name) {
  const bp = BPS[name];
  fs.mkdirSync(`${OUT}/screenshots/${name}`, { recursive: true }); fs.mkdirSync(`${OUT}/logs`, { recursive: true });
  const queue = routes.slice(); const results = []; let done = 0; const t0 = Date.now();
  async function worker() {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => cdp.send(m, p, sessionId);
    await Promise.all(['Page', 'Runtime', 'Log', 'Network'].map((d) => S(d + '.enable')));
    await S('Emulation.setDeviceMetricsOverride', { width: bp.w, height: bp.h, deviceScaleFactor: 1, mobile: bp.mobile });
    if (bp.mobile) await S('Emulation.setTouchEmulationEnabled', { enabled: true });
    let events = [], reqUrl = new Map(), loadResolve = null;
    cdp.on(sessionId, (m) => {
      const p = m.params;
      if (m.method === 'Page.loadEventFired' && loadResolve) loadResolve();
      else if (m.method === 'Network.requestWillBeSent') reqUrl.set(p.requestId, p.request.url);
      else if (m.method === 'Network.responseReceived' && p.response.status >= 400) events.push(`HTTP ${p.response.status} ${p.response.url.replace(BASE, '')}`);
      else if (m.method === 'Network.loadingFailed' && !p.canceled && p.errorText !== 'net::ERR_ABORTED') events.push(`NETFAIL ${p.errorText} ${(reqUrl.get(p.requestId) || '').replace(BASE, '')}`);
      else if (m.method === 'Runtime.exceptionThrown') events.push('EXCEPTION ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).slice(0, 200));
      else if (m.method === 'Runtime.consoleAPICalled' && (p.type === 'error' || p.type === 'warning')) { const t = p.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 220); if (!NOISE.test(t)) events.push(`CONSOLE.${p.type} ${t}`); }
      else if (m.method === 'Log.entryAdded' && (p.entry.level === 'error' || p.entry.level === 'warning')) { const t = `${p.entry.text} ${p.entry.url || ''}`.slice(0, 220); if (!NOISE.test(t)) events.push(`LOG.${p.entry.level} ${t.replace(BASE, '')}`); }
    });
    while (queue.length) {
      const route = queue.shift(); events = []; reqUrl = new Map(); const rec = { route, bp: name, issues: [], events: [] };
      try {
        const loaded = new Promise((r) => { loadResolve = r; });
        const nav = await S('Page.navigate', { url: BASE + route });
        if (nav.errorText) throw new Error(nav.errorText);
        await Promise.race([loaded, new Promise((r) => setTimeout(r, 25000))]);
        await new Promise((r) => setTimeout(r, 500));
        const h = (await S('Runtime.evaluate', { expression: SCROLL, awaitPromise: true, returnByValue: true })).result.value;
        rec.revealHiddenAfterScroll = (await S('Runtime.evaluate', { expression: "document.querySelectorAll('.reveal-hidden:not(.in)').length + '/' + document.querySelectorAll('.reveal').length", returnByValue: true })).result.value;
        const aud = await S('Runtime.evaluate', { expression: AUDIT, returnByValue: true });
        rec.issues = aud.result.value || [];
        const shot = await S('Page.captureScreenshot', { format: 'jpeg', quality: 55, captureBeyondViewport: true, clip: { x: 0, y: 0, width: bp.w, height: Math.min(h || bp.h, 3200), scale: 1 } });
        fs.writeFileSync(`${OUT}/screenshots/${name}/${slugOf(route)}.jpg`, Buffer.from(shot.data, 'base64'));
        rec.height = h;
      } catch (e) { rec.issues.push('HARNESS-ERROR: ' + String(e.message).slice(0, 160)); }
      rec.events = [...new Set(events)];
      results.push(rec); done++;
      if (done % 50 === 0) console.log(`${name}: ${done}/${routes.length}`);
    }
    await cdp.send('Target.closeTarget', { targetId });
  }
  await Promise.all(Array.from({ length: conc }, worker));
  results.sort((a, b) => a.route.localeCompare(b.route));
  fs.writeFileSync(`${OUT}/logs/cdp-${name}.json`, JSON.stringify(results, null, 1));
  const kinds = {}; let evPages = 0, isPages = 0;
  for (const r of results) { if (r.events.length) evPages++; if (r.issues.length) isPages++; for (const i of r.issues) { const k = i.split(':')[0].split(' ')[0]; kinds[k] = (kinds[k] || 0) + 1; } }
  console.log(`done ${name}: ${results.length} pages in ${Math.round((Date.now() - t0) / 1000)}s | pages with console/network events: ${evPages} | pages with audit issues: ${isPages}`);
  console.log('  issue kinds:', JSON.stringify(kinds));
}

for (const n of bpNames) await runBreakpoint(n);
cleanup(); process.exit(0);
