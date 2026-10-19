// In-browser layout audit. Paste into the browser console on any page of the running site (http://localhost:3100).
// It loads each route in an off-screen iframe at 3 widths and records structural problems. Results: window.__qa
// Usage: window.__qaRun(routesArray) then read window.__qa.
window.__qaRun = async function (routes, widths = [375, 820, 1280]) {
  window.__qa = { done: false, issues: [], checked: 0 };
  const sel = (e) => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')).slice(0, 70);
  for (const w of widths) {
    for (const r of routes) {
      const f = document.createElement('iframe');
      f.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:900px;border:0;opacity:0;pointer-events:none`;
      document.body.appendChild(f);
      await new Promise((res) => { f.onload = res; f.src = r; });
      await new Promise((res) => setTimeout(res, 400));
      const d = f.contentDocument, win = f.contentWindow, out = [];
      const add = (k, v) => out.push(k + (v ? ': ' + v : ''));
      if (d.documentElement.scrollWidth > w + 1) add('H-OVERFLOW', d.documentElement.scrollWidth + 'px');
      const inScroller = (e) => { for (let p = e.parentElement; p; p = p.parentElement) { const o = win.getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
      const off = [...d.body.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); const cs = win.getComputedStyle(e); return b.width > 0 && b.height > 0 && (b.right > w + 1 || b.left < -1) && cs.position !== 'fixed' && cs.position !== 'absolute' && !inScroller(e); });
      if (off.length) add('OFFSCREEN', off.length + ' e.g. ' + off.slice(0, 2).map(sel).join(' | '));
      const broken = [...d.images].filter((i) => i.complete && i.naturalWidth === 0); if (broken.length) add('BROKEN-IMG', broken.length);
      const clipped = [...d.body.querySelectorAll('h1,h2,h3,p,li,a,button,label,span,div')].filter((e) => { const cs = win.getComputedStyle(e); return (cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis') && e.scrollWidth > e.clientWidth + 2 && e.textContent.trim().length > 0 && !e.closest('pre,table'); });
      if (clipped.length) add('CLIPPED-TEXT', clipped.slice(0, 2).map(sel).join(' | '));
      const tiny = [...d.body.querySelectorAll('button,input,select,textarea,a')].filter((e) => { const b = e.getBoundingClientRect(); const cs = win.getComputedStyle(e); if (b.width === 0 || cs.visibility === 'hidden' || e.closest('p,li,dd') && cs.display === 'inline') return false; return (b.height < 24 || b.width < 24) && !e.classList.contains('sr-only'); });
      if (tiny.length) add('SMALL-TARGET(<24px)', tiny.length + ' e.g. ' + tiny.slice(0, 2).map(sel).join(' | '));
      const h1 = d.querySelector('h1'), nav = d.querySelector('nav[aria-label="Main"]'), bn = d.querySelector('main > div, body > div');
      if (h1 && nav) { const a = h1.getBoundingClientRect(), b = nav.getBoundingClientRect(); if (a.top < b.bottom + 4 && a.bottom > b.top) add('NAV-OVERLAPS-H1', ''); }
      const leaves = [...d.body.querySelectorAll('h1,h2,h3,p,li,label,button,a')].filter((e) => !e.querySelector('h1,h2,h3,p,li,label,button,a') && e.getBoundingClientRect().width > 0 && win.getComputedStyle(e).visibility !== 'hidden' && e.textContent.trim());
      const rects = leaves.map((e) => [e, e.getBoundingClientRect()]); let ov = 0, ex = '';
      for (let i = 0; i < rects.length && ov < 3; i++) for (let j = i + 1; j < rects.length; j++) { const [ea, a] = rects[i], [eb, b] = rects[j]; if (ea.contains(eb) || eb.contains(ea)) continue; const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (ix > 4 && iy > 4 && ix * iy > 0.25 * Math.min(a.width * a.height, b.width * b.height)) { ov++; ex = sel(ea) + ' x ' + sel(eb); break; } }
      if (ov) add('TEXT-OVERLAP', ex);
      const hidden = d.querySelectorAll('.reveal-hidden:not(.in)').length; if (hidden && w > 0) { /* below-the-fold reveals are expected; only flag if in viewport */ const vis = [...d.querySelectorAll('.reveal-hidden:not(.in)')].filter((e) => e.getBoundingClientRect().top < 900 && e.getBoundingClientRect().bottom > 0); if (vis.length) add('REVEAL-STUCK-IN-VIEW', vis.length); }
      if (d.querySelectorAll('main').length !== 1) add('MAIN-COUNT', d.querySelectorAll('main').length);
      if (out.length) window.__qa.issues.push([w, r, out]);
      window.__qa.checked++; f.remove();
    }
  }
  window.__qa.done = true;
};
