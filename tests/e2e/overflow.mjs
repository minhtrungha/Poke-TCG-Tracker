// Phone-width overflow: on every page, in every theme/palette, nothing may
// stick out past the right edge (that silently widens the page, stretches
// the fixed bottom nav off-screen and shifts every tap). Names the culprits.
import { launch, sleep } from './cdp.mjs';
const B = process.env.BASE || 'http://localhost:5144/';
const b = await launch();
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${x ? '  — ' + x : ''}`); };

for (const w of [390, 360]) {
  await b.viewport(w, 800, true, 2);
  for (const theme of ['light', 'dark']) for (const pal of ['purple', 'green']) {
    for (const p of ['index', 'cards', 'sealed', 'sets', 'wishlist']) {
      await b.send('Page.navigate', { url: B + p + '.html' }); await sleep(400);
      await b.ev(`localStorage.setItem('ptcg-theme','${theme}'); localStorage.setItem('ptcg-palette','${pal}')`);
      await b.send('Page.navigate', { url: B + p + '.html' }); await sleep(1600);
      const r = await b.ev(`(()=>{
        const W = document.documentElement.clientWidth, sw = document.documentElement.scrollWidth;
        const off = [];
        for (const e of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(e);
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
          // inside a deliberately scrollable strip is fine
          let n = e.parentElement, inScroller = false;
          for (; n && n !== document.body; n = n.parentElement) {
            const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') { inScroller = true; break; }
          }
          if (inScroller) continue;
          const rr = e.getBoundingClientRect();
          if (rr.width && rr.right > W + 1) off.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).join('.') : '')) + ' →' + Math.round(rr.right));
        }
        const nav = document.querySelector('.botnav');
        const navOk = !nav || [...nav.children].every((a) => { const q = a.getBoundingClientRect(); return q.right <= W + 1 && q.left >= -1; });
        return { W, sw, navOk, off: [...new Set(off)].slice(0, 6) };
      })()`);
      t(`[${w} ${theme} ${pal}] ${p}: no sideways overflow, all 5 tabs on screen`,
        r.sw <= r.W + 1 && r.navOk && !r.off.length, `scrollWidth ${r.sw}/${r.W}${r.navOk ? '' : ' · bottom-nav tabs off-screen'}${r.off.length ? ' · ' + r.off.join(', ') : ''}`);
    }
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
b.close(); process.exit(fail ? 1 : 0);
