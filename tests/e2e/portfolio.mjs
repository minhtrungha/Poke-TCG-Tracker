// Agent A tests: hero total, chart tooltip (mouse/touch/keyboard), movers.
// usage: node --no-warnings --experimental-websocket testA.mjs <base> <shotdir>
import { launch, sleep } from './cdp.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
const B = process.argv[2] || (process.env.BASE || 'http://localhost:5144/');
const out = process.argv[3]; mkdirSync(out, { recursive: true });
const REAL = JSON.parse(readFileSync('data/prices.json', 'utf8'));
const b = await launch();
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${x !== '' ? '  — ' + x : ''}`); };

// ---- prices.json interception (fixtures) ----
let override = null;            // function(json) -> json, or null for the real file
await b.send('Network.setBypassServiceWorker', { bypass: true });
await b.send('Fetch.enable', { patterns: [{ urlPattern: '*data/prices.json*', requestStage: 'Request' }] });
const errs = [];
(async function pump() {
  for (;;) {
    for (const e of b.events.splice(0)) {
      if (e.method === 'Fetch.requestPaused') {
        const body = JSON.stringify(override ? override(structuredClone(REAL)) : REAL);
        b.send('Fetch.fulfillRequest', { requestId: e.params.requestId, responseCode: 200,
          responseHeaders: [{ name: 'content-type', value: 'application/json' }],
          body: Buffer.from(body).toString('base64') });
      }
      if (e.method === 'Runtime.exceptionThrown') errs.push(e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text);
      if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') errs.push(e.params.args.map((a) => a.value || a.description).join(' '));
      if (e.method === 'Network.responseReceived' && e.params.response.status >= 400) errs.push(`HTTP ${e.params.response.status} ${e.params.response.url}`);
      if (e.method === 'Network.loadingFailed' && !e.params.canceled) errs.push(`FAILED ${e.params.errorText}`);
    }
    await sleep(15);
  }
})();

const go = async (theme = 'light', pal = 'purple') => {
  await b.send('Page.navigate', { url: B + 'index.html' }); await sleep(250);
  await b.ev(`localStorage.setItem('ptcg-theme','${theme}'); localStorage.setItem('ptcg-palette','${pal}')`);
  await b.send('Page.navigate', { url: B + 'index.html' }); await sleep(1500);
};
const box = (sel) => b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}})()`);
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', { type, x, y, button: 'none', ...extra });
const tipDate = () => b.ev(`(()=>{const t=document.querySelector('.c-tip'); return t && !t.hidden ? t.querySelector('.ct-date').textContent : null})()`);
const tipInside = () => b.ev(`(()=>{const t=document.querySelector('.c-tip'), f=document.querySelector('figure.chart');
  if(!t||t.hidden) return 'hidden'; const a=t.getBoundingClientRect(), c=f.getBoundingClientRect();
  return a.left>=c.left-0.5 && a.right<=c.right+0.5 && a.top>=c.top-0.5 && a.bottom<=c.bottom+0.5 && a.left>=0 && a.right<=innerWidth})()`);
// viewport coords of point k from the chart's own data
const ptXY = (k) => b.ev(`(()=>{const f=document.querySelector('figure.chart'); const d=JSON.parse(f.dataset.pts); const s=f.querySelector('svg').getBoundingClientRect();
  const p=d[${k}]; return [s.left + p.x/(+f.dataset.w)*s.width, s.top + p.y/(+f.dataset.h)*s.height, d.length, p.date]})()`);
const key = async (k, code, vk) => {
  await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk });
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
};

/* ============ 1. hero with the real data ============ */
await b.viewport(1440, 900);
await go();
const hero = await b.ev(`(()=>{const h=document.getElementById('hero'); return {
  v:h.querySelector('.hero-v')?.textContent, chg:h.querySelector('.hero-chg')?.textContent.replace(/\\s+/g,' ').trim(),
  since:h.querySelector('.hero-since')?.textContent, meta:h.querySelector('.hero-meta')?.textContent.trim(), cls:h.className,
  parts:[...h.querySelectorAll('.hero-parts dd')].map(d=>d.textContent.replace(/\\s+/g,' ').trim())}})()`);
const cardsT = 2104.24, sealedT = 904.49;
t('hero shows total holdings = cards + sealed', hero.v === '$3,008.73', hero.v);
t('hero change vs previous sync', /▲/.test(hero.chg) && /\$162\.13/.test(hero.chg) && /\+5\.7%/.test(hero.chg) && hero.since === 'since Nov 11, 2026', `${hero.chg} ${hero.since}`);
t('hero breakdown cards vs sealed', /\$2,104/.test(hero.parts[0]) && /\$904/.test(hero.parts[1]) && /70%/.test(hero.parts[0]) && /30%/.test(hero.parts[1]), hero.parts.join(' | '));
t('hero folds in the last-updated date', /Prices updated Nov 12, 2026/.test(hero.meta) && !/stale/.test(hero.cls), hero.meta);
const sizes = await b.ev(`(()=>{const hv=parseFloat(getComputedStyle(document.querySelector('.hero-v')).fontSize);
  let max=0, who=''; for(const e of document.querySelectorAll('main *')){ if(e.closest('#hero')) continue; if(!e.childNodes.length) continue;
    const own=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()); if(!own) continue; const fs=parseFloat(getComputedStyle(e).fontSize); if(fs>max){max=fs;who=e.className||e.tagName} }
  return {hv,max,who}})()`);
t('hero total is the biggest text on the page', sizes.hv > sizes.max, `hero ${sizes.hv}px vs next ${sizes.max}px (${sizes.who})`);
t('no separate banner, no "Total holdings" stat tile', await b.ev(`!document.getElementById('banner') && ![...document.querySelectorAll('.stat-k')].some(k=>/total holdings/i.test(k.textContent))`));
await b.shot(`${out}/desk-light-purple.png`);

/* ============ 2. movers with the real _prev ============ */
const mv = await b.ev(`(()=>{const m=document.getElementById('movers'); const g=[...m.querySelectorAll('.mv-col.up .mv')], l=[...m.querySelectorAll('.mv-col.down .mv')];
  const row=e=>e.querySelector('.mv-n').textContent.replace(/\\s+/g,' ').trim()+' '+e.querySelector('.mv-d').textContent.replace(/\\s+/g,' ').trim();
  return {hidden:m.hidden, head:m.querySelector('.sec-h')?.textContent, g:g.map(row), l:l.map(row)}})()`);
t('movers section shown with the previous sync date', !mv.hidden && mv.head === 'Biggest movers since Nov 11, 2026', mv.head);
t('5 gainers, 5 losers', mv.g.length === 5 && mv.l.length === 5, `${mv.g.length}/${mv.l.length}`);
t('top gainer is Squirtle +$0.78 (real Nov 11 → Nov 12 data)', /^Squirtle/.test(mv.g[0]) && /\$0\.78/.test(mv.g[0]), mv.g[0]);
t('top loser is Lugia V −$1.48', /^Lugia V/.test(mv.l[0]) && /\$1\.48/.test(mv.l[0]), mv.l[0]);
// independent check of the numbers against the raw JSON
{
  const cards = JSON.parse(readFileSync('data/cards.json', 'utf8'));
  const ch = cards.map((c) => { const o = REAL._prev[c.set_key]?.[c.number], n = REAL[c.set_key]?.[c.number];
    return (typeof o === 'number' && typeof n === 'number') ? { n: c.name, d: Math.round((n - o) * 100) / 100 } : null; })
    .filter((x) => x && Math.abs(x.d) >= 0.01);
  const top = ch.filter((x) => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 5).map((x) => x.n);
  const shown = mv.g.map((s) => s.split(/ (EN|JP) /)[0]);
  t('gainers list matches an independent computation from prices.json', JSON.stringify(top) === JSON.stringify(shown), `${top.join(', ')}`);
  const cnt = await b.ev(`document.querySelector('.mv-sub').textContent`);
  t('changed-card count matches', cnt.startsWith(`${ch.length} of `), cnt);
}
const m0 = await box('#movers .mv-col.down .mv');
await b.ev(`document.querySelector('#movers .mv-col.down .mv').scrollIntoView({block:'center'})`); await sleep(200);
const m1 = await box('#movers .mv-col.down .mv');
await mouse('mouseMoved', m1.x + m1.w / 2, m1.y + m1.h / 2);
await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: m1.x + m1.w / 2, y: m1.y + m1.h / 2, button: 'left', clickCount: 1 });
await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: m1.x + m1.w / 2, y: m1.y + m1.h / 2, button: 'left', clickCount: 1 });
await sleep(450);
const dt = await b.ev(`(()=>{const d=document.querySelector('dialog.dt[open]'); return d ? {t:d.querySelector('#dt-title').textContent.trim(), txt:d.textContent.replace(/\\s+/g,' ')} : null})()`);
t('clicking a mover opens the detail sheet for that card', dt && /^Lugia V/.test(dt.t), dt && dt.t);
t('(info) sheet renders priceChange from Agent D', true, dt && /Nov 11/.test(dt.txt) ? 'rendered' : 'not rendered (yet) — field is passed');
await b.shot(`${out}/desk-mover-sheet.png`);
await key('Escape', 'Escape', 27); await sleep(250);

/* ============ 3. grid & filters still work ============ */
const before = await b.ev(`document.getElementById('count').textContent`);
await b.ev(`(()=>{const s=document.getElementById('fLang'); s.value='JP'; s.dispatchEvent(new Event('change'))})()`); await sleep(200);
const after = await b.ev(`document.getElementById('count').textContent`);
t('language filter still filters the grid', before !== after && /\d+ cards?/.test(after), `${before} → ${after}`);
t('"Shown" tile appears when filtered', await b.ev(`[...document.querySelectorAll('.stat-k')].some(k=>k.textContent==='Shown')`));
await b.ev(`document.querySelector('#out .card-hit').click()`); await sleep(400);
t('grid card still opens the detail sheet', await b.ev(`!!document.querySelector('dialog.dt[open]')`));
await key('Escape', 'Escape', 27); await sleep(200);

/* ============ 4. chart tooltip with an 8-point fixture ============ */
const FIX = [
  ['Jun 02, 2026', 2210.4, 141, 1702.1, 508.3], ['Jul 01, 2026', 2388.9, 143, 1830.2, 558.7],
  ['Aug 04, 2026', 2301.2, 144, 1760.0, 541.2], ['Sep 01, 2026', 2560.0, 145, 1931.5, 628.5],
  ['Sep 29, 2026', 2499.7, 146, 1880.9, 618.8], ['Oct 20, 2026', 2722.3, 147, 2011.0, 711.3],
  ['Nov 11, 2026', 2846.6, 149, 2109.64, 736.96], ['Nov 12, 2026', 3008.73, 149, 2104.24, 904.49],
].map(([date, total, cards, cards_total, sealed_total]) => ({ date, total, cards, cards_total, sealed_total }));
override = (j) => { j.history = FIX; return j; };
await go();
await b.ev(`document.getElementById('chart').scrollIntoView({block:'center'})`); await sleep(250);
let [x0, y0, n] = await ptXY(0);
t('fixture chart renders all points', n === 8 && (await b.ev(`document.querySelectorAll('.c-pt').length`)) === 8, String(n));
t('tooltip hidden until hover', (await tipDate()) === null);
// hover between points: should snap to the nearest by x
const [xa] = await ptXY(3), [xb] = await ptXY(4);
await mouse('mouseMoved', xa + (xb - xa) * 0.3, y0 - 60); await sleep(120);
t('hover anywhere over the plot snaps to the nearest point (left of midpoint)', (await tipDate()) === FIX[3].date, await tipDate());
await mouse('mouseMoved', xa + (xb - xa) * 0.7, y0 - 140); await sleep(120);
t('…and right of midpoint', (await tipDate()) === FIX[4].date, await tipDate());
const tipTxt = await b.ev(`document.querySelector('.c-tip').textContent.replace(/\\s+/g,' ').trim()`);
t('tooltip shows date, total, change vs previous, cards and sealed', /\$2,499\.70/.test(tipTxt) && /▼ \$60\.30/.test(tipTxt) && /since Sep 01, 2026/.test(tipTxt) && /Cards \(146\)\s*\$1,880\.90/.test(tipTxt) && /Sealed\s*\$618\.80/.test(tipTxt), tipTxt);
const g = await b.ev(`(()=>{const l=document.querySelector('.c-guide'), c=document.querySelector('.c-focus'); return {gv:l.getAttribute('visibility'), gx:l.getAttribute('x1'), cv:c.getAttribute('visibility'), on:document.querySelectorAll('.c-pt.on').length}})()`);
t('guide line + highlighted dot follow the point', g.gv === 'visible' && g.cv === 'visible' && g.on === 1, JSON.stringify(g));
for (const k of [0, 7]) {
  const [px, py] = await ptXY(k);
  await mouse('mouseMoved', px, py); await sleep(150);
  t(`tooltip stays inside the chart at point ${k}`, (await tipInside()) === true);
}
const fb = await box('figure.chart');
await mouse('mouseMoved', fb.x + fb.w / 2, fb.y + fb.h + 120); await sleep(150);
t('moving the mouse away hides the tooltip', (await tipDate()) === null);
await b.shot(`${out}/desk-chart-fixture.png`);
{ const [px, py] = await ptXY(5); await mouse('mouseMoved', px, py); await sleep(200); await b.shot(`${out}/desk-chart-tooltip.png`); }
await mouse('mouseMoved', 5, 5); await sleep(100);

// keyboard
await b.ev(`document.querySelector('.c-pt[tabindex="0"]').focus()`); await sleep(120);
t('keyboard: the latest point is the tab stop and shows its tooltip', (await tipDate()) === FIX[7].date, await tipDate());
await key('ArrowLeft', 'ArrowLeft', 37); await sleep(120);
t('keyboard: ← moves to the previous reading', (await tipDate()) === FIX[6].date, await tipDate());
await key('Home', 'Home', 36); await sleep(120);
t('keyboard: Home jumps to the first reading', (await tipDate()) === FIX[0].date);
await key('ArrowRight', 'ArrowRight', 39); await sleep(120);
t('keyboard: → moves forward', (await tipDate()) === FIX[1].date);
t('keyboard: roving tabindex (exactly one point tabbable)', (await b.ev(`document.querySelectorAll('.c-pt[tabindex="0"]').length`)) === 1);
t('keyboard: tooltip inside chart', (await tipInside()) === true);
await key('Escape', 'Escape', 27); await sleep(120);
t('keyboard: Esc hides the tooltip', (await tipDate()) === null);

/* ============ 5. mobile: touch, overflow, screenshots ============ */
await b.viewport(390, 844, true, 2);
await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
await go();
await b.ev(`document.getElementById('chart').scrollIntoView({block:'center'})`); await sleep(300);
const touch = (type, x, y) => b.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
{
  const [p2x, p2y] = await ptXY(2), [p6x] = await ptXY(6);
  await touch('touchStart', p2x + 1, p2y - 30); await sleep(120);
  t('touch: tap shows the nearest reading', (await tipDate()) === FIX[2].date, await tipDate());
  await touch('touchMove', (p2x + p6x) / 2 + 30, p2y - 30); await sleep(60);
  await touch('touchMove', p6x, p2y - 30); await sleep(120);
  t('touch: drag scrubs along the line', (await tipDate()) === FIX[6].date, await tipDate());
  await touch('touchEnd'); await sleep(150);
  t('touch: reading stays after the finger lifts', (await tipDate()) === FIX[6].date);
  t('touch: tooltip inside chart on a 390px phone', (await tipInside()) === true);
  for (const k of [0, 7]) { const [x, y] = await ptXY(k); await touch('touchStart', x, y); await touch('touchEnd'); await sleep(120);
    t(`touch: tooltip inside chart at edge point ${k} (390px)`, (await tipInside()) === true); }
  await b.shot(`${out}/mob-chart-touch.png`);
  const hb = await box('#hero');
  await touch('touchStart', hb.x + 20, hb.y + 20); await touch('touchEnd'); await sleep(150);
  t('touch: tapping elsewhere dismisses it', (await tipDate()) === null);
}
await b.send('Emulation.setTouchEmulationEnabled', { enabled: false });

/* ============ 6. stale states ============ */
await b.viewport(1440, 900);
override = (j) => { j.checked_date = 'Sep 20, 2026'; return j; };
await go();
let st = await b.ev(`(()=>{const h=document.getElementById('hero'); return {c:h.className, m:h.querySelector('.hero-meta').textContent.trim()}})()`);
t('stale (>30 days): warning folded into the hero', /\bstale\b/.test(st.c) && !/very/.test(st.c) && /Prices may be out of date/.test(st.m) && /days ago/.test(st.m), `${st.c} | ${st.m}`);
await b.shot(`${out}/desk-stale.png`);
override = (j) => { j.checked_date = 'Jun 01, 2026'; return j; };
await go();
st = await b.ev(`document.getElementById('hero').className`);
t('very stale (>90 days): red state', /stale very/.test(st), st);
override = (j) => { delete j.checked_date; return j; };
await go();
st = await b.ev(`document.getElementById('hero').className + ' | ' + document.querySelector('.hero-meta').textContent`);
t('never-updated: empty hero state', /empty/.test(st) && /never been updated/.test(st), st);
override = (j) => { delete j._prev; return j; };
await go();
t('no _prev: movers section stays hidden', await b.ev(`document.getElementById('movers').hidden`));
override = (j) => { j.history = j.history.slice(-1); return j; };
await go();
t('one history point: first-reading readout kept, hero has no change chip', await b.ev(`!!document.querySelector('.chart-first') && !document.querySelector('.hero-chg')`));
override = null;

/* ============ 7. themes × palettes × sizes ============ */
const combos = [['light', 'purple'], ['dark', 'purple'], ['light', 'green'], ['dark', 'green']];
for (const [vw, vh, mob, tag] of [[1440, 900, false, 'desk'], [390, 844, true, 'mob']]) {
  await b.viewport(vw, vh, mob, mob ? 2 : 1);
  for (const [th, pal] of combos) {
    await go(th, pal);
    if (mob) t(`[${th}/${pal}] 390px: no horizontal scroll`, await b.ev(`document.documentElement.scrollWidth <= innerWidth`), await b.ev(`document.documentElement.scrollWidth+'/'+innerWidth`));
    // contrast of new text on its own (opaque) surface
    const low = await b.ev(`(()=>{
      const p=s=>{const m=s.match(/rgba?\\(([^)]+)\\)/); if(m){const v=m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return [v[0],v[1],v[2],v[3]??1]}
        const c=s.match(/color\\(srgb ([^)]+)\\)/); if(c){const v=c[1].split(/[ \\/]+/).filter(Boolean).map(Number); return [v[0]*255,v[1]*255,v[2]*255,v[3]??1]} return null};
      const L=([r,g,b])=>{const f=x=>{x/=255;return x<=.03928?x/12.92:((x+.055)/1.055)**2.4}; return .2126*f(r)+.7152*f(g)+.0722*f(b)};
      const bg=e=>{for(let n=e;n;n=n.parentElement){const c=p(getComputedStyle(n).backgroundColor); if(c&&c[3]>0.98) return c; if(n.tagName==='BODY') return null} return null};
      const sels='.hero-k,.hero-v,.hero-chg,.hero-since,.hero-parts dt,.hero-parts dd,.hero-parts dd small,.hero-meta,.mv-n,.mv-s,.mv-now,.mv-d,.mv-h,.stat-sub,.chart-hint';
      const bad=[]; let n=0;
      for(const e of document.querySelectorAll(sels)){ const b=bg(e); if(!b) continue; const c=p(getComputedStyle(e).color); if(!c) continue; n++;
        const x=L(c), y=L(b), r=(Math.max(x,y)+.05)/(Math.min(x,y)+.05); if(r<4.5) bad.push(e.className+' '+r.toFixed(2)); }
      return {n, bad:[...new Set(bad)]}})()`);
    t(`[${tag} ${th}/${pal}] new text ≥ 4.5:1 (${low.n} nodes)`, low.bad.length === 0, low.bad.slice(0, 4).join(', '));
    await b.shot(`${out}/${tag}-${th}-${pal}.png`);
  }
}
await sleep(300);
t('no console errors or failed requests (whole run)', errs.length === 0, errs.slice(0, 5).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
b.close(); process.exit(fail ? 1 : 0);
