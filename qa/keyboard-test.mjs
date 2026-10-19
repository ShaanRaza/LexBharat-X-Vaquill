// Keyboard accessibility test via CDP (Node built-ins only): Tab order start, skip link visibility/activation, focus visibility.
import { spawn } from 'node:child_process';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=9334', '--user-data-dir=/tmp/qa-kb-profile', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let ver; for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch('http://127.0.0.1:9334/json/version')).json(); } catch { await new Promise(r => setTimeout(r, 200)); } }
const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
const send = (method, params = {}, sessionId) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S('Page.enable'); await S('Runtime.enable');
await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
const ev = async (expr) => (await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
const key = async (k, code) => { for (const t of ['keyDown', 'keyUp']) await S('Input.dispatchKeyEvent', { type: t, key: k, code, windowsVirtualKeyCode: k === 'Tab' ? 9 : 13 }); await new Promise(r => setTimeout(r, 150)); };
const results = [];
for (const path of ['/', '/docs', '/blog', '/auth/login', '/contact', '/nope']) {
  await S('Page.navigate', { url: 'http://localhost:3100' + path }); await new Promise(r => setTimeout(r, 2500));
  await key('Tab', 'Tab');
  const first = await ev(`(()=>{const a=document.activeElement; const r=a.getBoundingClientRect(); const cs=getComputedStyle(a); return {tag:a.tagName, text:(a.textContent||'').trim().slice(0,40), href:a.getAttribute('href'), visible:r.width>1&&r.height>1&&r.top>=0&&cs.visibility!=='hidden', outline:cs.outlineStyle+' '+cs.outlineWidth}})()`);
  let activated = null;
  if (first.href === '#main') { await key('Enter', 'Enter'); activated = await ev(`({hash:location.hash, mainExists:!!document.getElementById('main'), focusInMain: !!document.activeElement.closest('#main') || document.activeElement.id==='main'})`); }
  // keep tabbing: make sure focus always lands on something visible with an outline for 25 steps
  let bad = 0, n = 0; for (let i = 0; i < 25; i++) { await key('Tab', 'Tab'); const f = await ev(`(()=>{const a=document.activeElement; if(a===document.body) return {body:true}; const r=a.getBoundingClientRect(); const cs=getComputedStyle(a); return {vis:r.width>0&&r.height>0, outline: cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>0, boxShadow: cs.boxShadow!=='none'}})()`); n++; if (f.body || !f.vis || !(f.outline || f.boxShadow)) bad++; }
  results.push({ path, firstFocus: first, skipActivated: activated, focusSteps: n, focusProblems: bad });
}
console.log(JSON.stringify(results, null, 1));
chrome.kill(); process.exit(0);
