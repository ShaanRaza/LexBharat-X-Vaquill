// Playground QA: headless Chrome over CDP (Node built-ins only, no installs). For each breakpoint it drives the real UI
// (create mock key, open picker, run, cancel, code tabs, recent-run reload, drawer) and records overflow, console and layout problems.
//   node qa/playground-qa.mjs [--out qa/playground]   (needs the app on http://localhost:3100)
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const BASE = 'http://localhost:3100/developer?tab=playground';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9341;
const OUT = (() => { const i = process.argv.indexOf('--out'); return i > 0 ? process.argv[i + 1] : 'qa/playground'; })();
const BPS = [['mobile-360', 360, 740, true], ['mobile-390', 390, 844, true], ['tablet-820', 820, 1100, false], ['desktop-1280', 1280, 900, false]];
fs.mkdirSync(OUT, { recursive: true });

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.p = new Map(); this.h = new Map();
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data);
      if (m.id) { const x = this.p.get(m.id); if (x) { this.p.delete(m.id); m.error ? x.rej(new Error(m.error.message)) : x.res(m.result); } }
      else if (m.method) this.h.get(m.sessionId || '')?.(m); }); }
  send(method, params = {}, sessionId) { const id = ++this.id; return new Promise((res, rej) => { this.p.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params, sessionId })); }); }
  on(s, f) { this.h.set(s, f); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/qa-pg-profile', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let ver; for (let i = 0; i < 60; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await sleep(250); } }
const cdp = new CDP(new WebSocket(ver.webSocketDebuggerUrl)); await new Promise((r) => cdp.ws.addEventListener('open', r));
const report = [];

for (const [name, w, h, mobile] of BPS) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => cdp.send(m, p, sessionId);
  const problems = []; const consoleErrs = [];
  cdp.on(sessionId, (m) => {
    if (m.method === 'Runtime.exceptionThrown') consoleErrs.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 160));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrs.push('ERR ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 160));
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400 && !/favicon/.test(m.params.response.url)) consoleErrs.push('HTTP ' + m.params.response.status + ' ' + m.params.response.url);
  });
  await S('Page.enable'); await S('Runtime.enable'); await S('Network.enable');
  await S('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile });
  if (mobile) await S('Emulation.setTouchEmulationEnabled', { enabled: true });
  const ev = async (expr) => { const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed'); return r.result.value; };
  const shot = async (n, full = true) => { const { data } = await S('Page.captureScreenshot', { format: 'jpeg', quality: 70, captureBeyondViewport: full }); fs.writeFileSync(`${OUT}/${name}-${n}.jpg`, Buffer.from(data, 'base64')); };
  const overflow = () => ev(`(() => { const W = innerWidth, d = document.documentElement; const off = [...document.body.querySelectorAll('*')].filter(e => { const b = e.getBoundingClientRect(), cs = getComputedStyle(e); if (!b.width || cs.position==='fixed') return false; for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o==='auto'||o==='scroll'||o==='hidden') return false; } return b.right > W + 1 || b.left < -1; }); return { sw: d.scrollWidth, W, off: off.slice(0,3).map(e => e.tagName + '.' + String(e.className).slice(0,50)) }; })()`);
  const check = async (label) => { const o = await overflow(); if (o.sw > o.W + 1 || o.off.length) problems.push(`${label}: H-OVERFLOW sw=${o.sw} W=${o.W} ${o.off.join(' | ')}`); };
  const click = (sel, text) => ev(`(() => { const els = [...document.querySelectorAll(${JSON.stringify(sel)})]; const e = ${text ? `els.find(x => x.innerText.includes(${JSON.stringify(text)}))` : 'els[0]'}; if (!e) return 'missing'; e.click(); return 'ok'; })()`);

  await S('Page.navigate', { url: BASE }); await sleep(2500);
  await ev(`localStorage.clear(); sessionStorage.clear(); 1`); await S('Page.navigate', { url: BASE }); await sleep(2200);
  await check('initial'); await shot('01-initial');

  // mock state must be visible (also in production builds) and the title must say so
  const mockVis = await ev(`({ banner: !!document.querySelector('[role=note]')?.innerText.includes('Local mock'), badge: [...document.querySelectorAll('header span')].some(e => e.innerText.trim().toLowerCase() === 'local mock'), title: document.title })`);
  if (!mockVis.banner || !mockVis.badge || !/local mock/i.test(mockVis.title)) problems.push('MOCK-VISIBILITY: ' + JSON.stringify(mockVis));
  // sidebar: every item is a working link or intentionally disabled; nothing points at a dead tab
  if (w >= 768) {
    const nav = await ev(`[...document.querySelectorAll('nav[aria-label="Developer console"] li, nav[aria-label="Developer console"] > div > span')].length >= 0 && [...document.querySelectorAll('nav[aria-label="Developer console"] a, nav[aria-label="Developer console"] [aria-disabled=true]')].map(e => ({ t: e.innerText.split(String.fromCharCode(10)).join(' ').trim().slice(0, 40), href: e.getAttribute('href'), dis: e.getAttribute('aria-disabled') === 'true' }))`);
    const disabled = nav.filter((n) => n.dis).map((n) => (/^(Billing|Credits|Settings)/.exec(n.t) || [n.t])[0]).sort().join(',');
    if (disabled !== 'Billing,Credits,Settings') problems.push('SIDEBAR: disabled items = ' + disabled);
    if (nav.some((n) => n.dis && n.href)) problems.push('SIDEBAR: a disabled item is still a link');
    if (nav.some((n) => /tab=(settings|credits|billing)/.test(n.href || ''))) problems.push('SIDEBAR: link to a disabled tab');
    for (const [tab, text, cta] of [['law-changes', 'Alerts demo', '/alerts'], ['mcp', 'MCP page', '/mcp'], ['settings', 'not part of this clone', null], ['billing', 'not part of this clone', null]]) {
      await S('Page.navigate', { url: BASE.replace('playground', tab) }); await sleep(1500);
      const pg = await ev(`({ h1: document.querySelector('main h1')?.innerText, txt: document.querySelector('main').innerText, cta: [...document.querySelectorAll('main a')].map(a => a.getAttribute('href')) })`);
      if (!pg.h1 || !pg.txt.toLowerCase().includes(text.toLowerCase()) || (cta && !pg.cta.includes(cta))) problems.push('TAB-PAGE ' + tab + ': ' + JSON.stringify(pg).slice(0, 160));
    }
    await S('Page.navigate', { url: BASE }); await sleep(1800);
  }

  // small tap targets (interactive controls under 24px), excluding inline links in text
  const small = await ev(`[...document.querySelectorAll('main button, main input, main select, main textarea, header button, nav a')].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.height < 24 || b.width < 24) && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.sr-only'); }).map(e => (e.getAttribute('aria-label') || e.innerText || e.id).slice(0,30) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)).slice(0,6)`);
  if (small.length) problems.push('SMALL-TARGETS: ' + small.join(' | '));

  // drawer on narrow screens
  if (w < 768) {
    await click('button[aria-label="Open menu"]'); await sleep(400);
    const d = await ev(`({ open: !!document.querySelector('[role=dialog][aria-modal=true]'), focusIn: !!document.activeElement?.closest('[role=dialog]'), bodyLock: document.body.style.overflow })`);
    if (!d.open || !d.focusIn || d.bodyLock !== 'hidden') problems.push('DRAWER: ' + JSON.stringify(d));
    await shot('02-drawer', false); await check('drawer');
    await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(300);
    const closed = await ev(`!document.querySelector('[role=dialog][aria-modal=true]') && document.body.style.overflow !== 'hidden'`);
    if (!closed) problems.push('DRAWER: did not close on Escape');
  }

  // picker + search endpoint
  await click('button[aria-label=Endpoint]'); await sleep(350); await shot('03-picker', false); await check('picker open');
  const lb = await ev(`({ opts: document.querySelectorAll('[role=option]').length, panelRight: Math.round(document.querySelector('[role=listbox]').getBoundingClientRect().right), W: innerWidth })`);
  if (lb.opts !== 25) problems.push('PICKER: expected 25 options, got ' + lb.opts); if (lb.panelRight > lb.W) problems.push('PICKER: panel overflows viewport');
  await ev(`[...document.querySelectorAll('[role=option]')].find(x => x.innerText.includes('Search statutes')).click(); 1`); await sleep(300);
  await check('search form'); await shot('04-search-gated');
  const gated = await ev(`({ banner: !!([...document.querySelectorAll('button')].find(b => b.innerText.includes('Create API key'))), runDisabled: [...document.querySelectorAll('button')].find(b => b.innerText.includes('Run')).disabled })`);
  if (!gated.banner || !gated.runDisabled) problems.push('GATING: ' + JSON.stringify(gated));

  // key -> chip -> run -> cancel -> run -> output
  await click('button', 'Create API key'); await sleep(250); await click('button', 'At-will termination notice'); await sleep(150);
  await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('Run')).click(); 1`); await sleep(120);
  await shot('05-running', false);
  const cancelled = await ev(`(async () => { const c = [...document.querySelectorAll('button')].find(b => b.innerText.includes('Cancel')); if (!c) return 'no-cancel'; c.click(); await new Promise(r => setTimeout(r, 900)); return { running: !![...document.querySelectorAll('button')].find(b => b.innerText.includes('Cancel')), empty: document.querySelector('section[aria-label=Output]').innerText.includes('No response yet'), recent: document.querySelectorAll('section[aria-label="Recent runs"] li').length }; })()`);
  if (cancelled === 'no-cancel' || cancelled.running || !cancelled.empty || cancelled.recent) problems.push('CANCEL: ' + JSON.stringify(cancelled));
  // rapid cancel + rerun race
  const race = await ev(`(async () => { const r = () => [...document.querySelectorAll('button')].find(b => b.innerText.includes('Run')); const c = () => [...document.querySelectorAll('button')].find(b => b.innerText.includes('Cancel')); r().click(); await new Promise(x => setTimeout(x, 60)); c().click(); await new Promise(x => setTimeout(x, 30)); r().click(); await new Promise(x => setTimeout(x, 1800)); return { stillRunning: !!c(), out: document.querySelector('section[aria-label=Output] h2')?.innerText, recent: document.querySelectorAll('section[aria-label="Recent runs"] li').length }; })()`);
  if (race.stillRunning || race.out !== 'Results (5)' || race.recent !== 1) problems.push('RACE: ' + JSON.stringify(race));
  await check('results'); await shot('06-results');

  // keyboard shortcut
  // code tabs
  const code = await ev(`(async () => { const t = n => [...document.querySelectorAll('[role=tab]')].find(x => x.getAttribute('aria-label') === n); t('Code').click(); await new Promise(r => setTimeout(r, 200)); const o = {}; for (const l of ['cURL','Python','JavaScript']) { t(l).click(); await new Promise(r => setTimeout(r, 150)); o[l] = document.querySelector('section[aria-label=Code] pre').innerText; } o.jsNumbered = document.querySelector('section[aria-label=Code] pre').innerText.startsWith('1'); return o; })()`);
  if (!/method: "POST"\n/.test(code.JavaScript.replace(/^\d+\n?/gm, '')) && !code.JavaScript.includes('method: "POST"')) problems.push('CODE: JS missing method line');
  if (/method: "POST",/.test(code.JavaScript)) problems.push('CODE: JS comma bug NOT reproduced');
  if (!code.cURL.startsWith("curl -X POST 'https://api.vaquill.ai/api/v1/us/statutes/search'")) problems.push('CODE: cURL header wrong');
  await check('code tab'); await shot('07-code-js');
  // keyboard tab navigation
  const kb = await ev(`(async () => { const t = [...document.querySelectorAll('[role=tab]')].find(x => x.getAttribute('aria-label') === 'cURL'); t.focus(); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await new Promise(r => setTimeout(r, 150)); return document.activeElement.getAttribute('aria-label'); })()`);
  if (kb !== 'Python') problems.push('TABS: ArrowRight went to ' + kb);

  // recent reload
  await ev(`[...document.querySelectorAll('[role=tab]')].find(x => x.getAttribute('aria-label') === 'Output').click(); 1`);
  await ev(`document.querySelector('button[aria-label=Endpoint]').click(); 1`); await sleep(250);
  await ev(`[...document.querySelectorAll('[role=option]')].find(x => x.innerText.includes('Pricing')).click(); 1`); await sleep(200);
  await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('Run')).click(); 1`); await sleep(1500);
  await check('pricing results'); await shot('08-pricing');
  const rel = await ev(`(async () => { const n0 = document.querySelectorAll('section[aria-label="Recent runs"] li').length; [...document.querySelectorAll('section[aria-label="Recent runs"] li button')].find(b => b.innerText.includes('Search statutes')).click(); await new Promise(r => setTimeout(r, 300)); return { n0, n1: document.querySelectorAll('section[aria-label="Recent runs"] li').length, ep: document.querySelector('button[aria-label=Endpoint]').innerText.includes('Search statutes'), q: document.querySelector('#pg-primary')?.value, out: document.querySelector('section[aria-label=Output] h2')?.innerText }; })()`);
  if (rel.n0 !== rel.n1 || !rel.ep || !rel.q || rel.out !== 'Results (5)') problems.push('RELOAD: ' + JSON.stringify(rel));

  // number validation
  await ev(`(async () => { const i = document.querySelector('#pg-limit'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '999'); i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 150)); })()`);
  const val = await ev(`({ err: document.querySelector('#pg-limit-err')?.innerText, runDisabled: [...document.querySelectorAll('button')].find(b => b.innerText.includes('Run')).disabled })`);
  if (!val.err || !val.runDisabled) problems.push('VALIDATION: ' + JSON.stringify(val));

  if (name === 'desktop-1280') {
    const api = await ev(`(async () => {
      const post = async (id, values, apiKey = 'k') => (await fetch('/api/playground/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpointId: id, values, apiKey }) })).json();
      const spec = (await (await fetch('/api/playground/spec?jurisdiction=US')).json()).endpoints.filter(e => e.runnable);
      const ex = (e) => Object.fromEntries(e.fields.filter(f => f.required).map(f => [f.name, f.kind === 'array' ? [f.example || 'x'] : (f.example ?? 'x')]));
      const sigs = {}; const bad = [];
      for (const e of spec) { if (!e.auth) continue; const r = await post(e.id, ex(e)); if (r.status !== 200) { bad.push(e.path + ' -> ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 80)); continue; } const sig = Object.keys(r.body).filter(k => !k.startsWith('_')).sort().join(','); (sigs[sig] ||= []).push(e.path.replace('/api/v1', '')); }
      const dupes = Object.values(sigs).filter(v => v.length > 1);
      const S = (v) => post('post:/api/v1/us/statutes/search', { query: 'x', limit: 50, ...v });
      const fed = await S({ state: 'federal' }), fedUp = await S({ state: 'FEDERAL' }), tx = await S({ state: 'tx' }), zz = await S({ state: 'zz' });
      const cnt = await post('post:/api/v1/us/statutes/count', { state: 'federal', corpusType: 'USC' });
      const cov = await post('get:/api/v1/us/statutes/coverage', { state: 'federal' });
      const spec2 = spec.find(e => e.path.endsWith('/statutes/search')).fields.find(f => f.name === 'state').enum;
      const divFed = await post('get:/api/v1/us/statutes/divisions', { corpusType: 'USC', state: 'federal' });
      const sl = spec.find(e => e.path.endsWith('/session-laws/list')).fields.find(f => f.name === 'jurisdiction').enum;
      return { bad, dupes, nEndpoints: spec.length, fedAll: fed.body.results.length > 0 && fed.body.results.every(r => r.state === 'federal'), fedUp: fedUp.status, tx: tx.body.results.every(r => r.state === 'tx'), zz: zz.status, zzMsg: zz.body.error, cntFed: cnt.body.count, covFed: !!cov.body.federal && cov.body.jurisdictions.length === 0, enumHasFederal: spec2[0] === 'federal', sessionLawsNoFederal: !sl.includes('federal'), divFed: divFed.status };
    })()`);
    if (api.bad.length) problems.push('API: ' + api.bad.join(' | '));
    if (api.dupes.length) problems.push('API-SHAPES: endpoints sharing a response shape: ' + JSON.stringify(api.dupes));
    if (!api.fedAll || api.fedUp !== 200 || !api.tx || api.zz !== 422 || api.cntFed !== 60494 || !api.covFed || !api.enumHasFederal || !api.sessionLawsNoFederal || api.divFed !== 422) problems.push('FEDERAL: ' + JSON.stringify(api));
    // federal selectable in the real form
    await S('Page.navigate', { url: BASE }); await sleep(1800);
    await click('button[aria-label=Endpoint]'); await sleep(250); await ev(`[...document.querySelectorAll('[role=option]')].find(x => x.innerText.includes('Search statutes')).click(); 1`); await sleep(250);
    await click('button', 'Create API key'); await sleep(200);
    await ev(`document.querySelector('#pg-state').click(); 1`); await sleep(250);
    const first = await ev(`[...document.querySelectorAll('[role=option]')].slice(0, 3).map(o => o.innerText.trim())`);
    if (first[1] !== 'federal') problems.push('FEDERAL-UI: first options ' + JSON.stringify(first));
    await ev(`[...document.querySelectorAll('[role=option]')].find(o => o.innerText.trim() === 'federal').click(); 1`); await sleep(200);
    await ev(`document.querySelector('#pg-primary').focus(); 1`);
    await S('Input.insertText', { text: 'fair use' }); await sleep(150);
    const ran = await ev(`(async () => { [...document.querySelectorAll('button')].find(b => b.innerText.includes('Run')).click(); await new Promise(r => setTimeout(r, 1500)); const c = [...document.querySelectorAll('[role=tab]')].find(x => x.getAttribute('aria-label') === 'Code'); c.click(); await new Promise(r => setTimeout(r, 200)); return { out: document.querySelector('section[aria-label=Code] pre').innerText.includes('"state": "federal"') }; })()`);
    if (!ran.out) problems.push('FEDERAL-UI: code snippet missing "state": "federal"');
  }

  report.push({ name, problems, consoleErrs: [...new Set(consoleErrs)] });
  await cdp.send('Target.closeTarget', { targetId });
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
for (const r of report) console.log(`${r.name}: ${r.problems.length ? r.problems.join('\n   ') : 'OK'}${r.consoleErrs.length ? '\n   console: ' + r.consoleErrs.join(' | ') : ''}`);
chrome.kill();
process.exit(0);
