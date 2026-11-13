// Agent D: deep links, history, swipe, back-to-top, priceChange.
import { launch, sleep } from './cdp.mjs';
import { mkdirSync } from 'node:fs';
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const B = (process.env.BASE || 'http://localhost:5144/');
const b = await launch();
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${x ? '  — ' + x : ''}`); };
const isOpen = () => b.ev(`!!document.querySelector('dialog.dt[open]')`);
const title = () => b.ev(`document.querySelector('#dt-title')?.textContent.trim()`);
const hash = () => b.ev(`location.hash`);
const hlen = () => b.ev(`history.length`);
const page = () => b.ev(`location.pathname.split('/').pop()`);
const waitFor = async (expr, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await b.ev(expr)) return true; await sleep(50); } return false; };
const errs = [];
const collect = () => { for (const e of b.events.splice(0)) {
  if (e.method === 'Runtime.exceptionThrown') errs.push(e.params.exceptionDetails.exception?.description);
  if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') errs.push(e.params.args.map((a) => a.value).join(' '));
  if (e.method === 'Network.responseReceived' && e.params.response.status >= 400) errs.push(`HTTP ${e.params.response.status} ${e.params.response.url}`);
} };
async function realClick(sel) {
  const p = await b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; e.scrollIntoView({block:'center'});
    const r=e.getBoundingClientRect(); return [r.x+r.width/2, r.y+Math.min(r.height/2,60)]})()`);
  if (!p) return false;
  for (const type of ['mousePressed', 'mouseReleased'])
    await b.send('Input.dispatchMouseEvent', { type, x: p[0], y: p[1], button: 'left', clickCount: 1 });
  return true;
}
const key = async (k) => {
  const code = { Escape: 27, ArrowRight: 39, ArrowLeft: 37 }[k];
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: code });
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k });
};

await b.viewport(1440, 900);
// 1. deep link on load
await b.send('Page.navigate', { url: B + 'cards.html#card=c20' });
t('deep link #card=c20 opens the sheet on load', await waitFor(`!!document.querySelector('dialog.dt[open]')`));
const c20 = await b.ev(`fetch('data/cards.json').then(r=>r.json()).then(a=>a.find(c=>c.id===20).name)`);
t('deep link shows card id 20', (await title() || '').startsWith(c20), `${c20} → ${await title()}`);
await key('Escape'); await sleep(250);
t('closing a deep-linked sheet strips the hash, stays on page', !(await isOpen()) && (await hash()) === '' && (await page()) === 'cards.html');
await b.send('Page.navigate', { url: B + 'cards.html#card=nope' }); await sleep(1600);
t('unknown id: no sheet, no error', !(await isOpen()));

// 2. click → pushState; Back closes; second Back leaves
await b.send('Page.navigate', { url: B + 'index.html' }); await sleep(1500);
await b.send('Page.navigate', { url: B + 'cards.html' }); await sleep(1500);
const h0 = await hlen();
await realClick('#out .card[data-i] .card-n'); await sleep(400);
t('click opens sheet and sets #card=', (await isOpen()) && /^#card=c\d+$/.test(await hash()), await hash());
t('opening adds exactly one history entry', (await hlen()) === h0 + 1, `${h0} → ${await hlen()}`);
await key('ArrowRight'); await sleep(200); await key('ArrowRight'); await sleep(200); await key('ArrowLeft'); await sleep(200);
t('‹ › update the hash without growing history', (await hlen()) === h0 + 1 && /^#card=/.test(await hash()), `${await hlen()} ${await hash()}`);
await b.ev(`history.back()`); await sleep(500);
t('Back closes the sheet', !(await isOpen()) && (await hash()) === '' && (await page()) === 'cards.html');
t('scroll lock released after Back', !(await b.ev(`document.documentElement.classList.contains('dt-open')`)));
await b.ev(`history.forward()`); await sleep(500);
t('Forward re-opens the sheet', await isOpen(), await title());
await b.ev(`history.back()`); await sleep(500);
await b.ev(`history.back()`); await waitFor(`location.pathname.endsWith('index.html')`); await sleep(600);
t('second Back leaves the page normally', (await page()) === 'index.html', await page());
await waitFor(`!document.documentElement.className.includes('ball')`, 2000);
t('no Pokéball left covering after Back', !(await b.ev(`document.documentElement.className.includes('ball')`)));

// 3. close via × goes back over the pushed entry (no pile-up)
await b.send('Page.navigate', { url: B + 'sets.html' }); await sleep(1500);
const h1 = await hlen();
await realClick('#out button.pk'); await sleep(350);
await b.ev(`document.querySelector('.dt-x').click()`); await sleep(450);
t('× close returns history to where it was', (await hlen()) >= h1 && (await hash()) === '' && !(await isOpen()), `len ${h1}→${await hlen()}`);
await realClick('#out button.pk'); await sleep(350);
await b.ev(`(()=>{const d=document.querySelector('dialog.dt'); d.dispatchEvent(new MouseEvent('click',{bubbles:true}))})()`); await sleep(450);
t('backdrop close also clears the hash', !(await isOpen()) && (await hash()) === '');

// 4. tab transition after using a sheet
await realClick('#out button.pk'); await sleep(300); await key('Escape'); await sleep(400);
await realClick('.nav a.tab[href="wishlist.html"]'); await sleep(60);
t('Pokéball transition still fires after a sheet was used', (await b.ev(`document.documentElement.className`)).includes('ball-leave'));
await waitFor(`location.pathname.endsWith('wishlist.html')`);
await b.ev(`history.back()`); await waitFor(`location.pathname.endsWith('sets.html')`); await sleep(900);
t('Back to previous tab: open, no sheet, no ball', !(await isOpen()) && !(await b.ev(`document.documentElement.className.includes('ball-leave')`)));

// 5. priceChange rendering (injected)
await b.send('Page.navigate', { url: B + 'index.html' }); await sleep(1500);
const pcRes = await b.ev(`import('./js/detail.js').then(m=>{
  m.openDetail([{kind:'owned',title:'Test Up',price:12.5,priceChange:{delta:2.25,pct:22.04,since:'Nov 11, 2026'}},
                {kind:'owned',title:'Test Down',price:9,priceChange:{delta:-1.5,pct:-14.3,since:'Nov 11, 2026'}},
                {kind:'owned',title:'Test None',price:9}],0);
  const a=document.querySelector('.dt-chg'); const r1=a&&a.className+'|'+a.textContent.trim();
  document.querySelector('[data-dt=next]').click(); const b2=document.querySelector('.dt-chg'); const r2=b2&&b2.className+'|'+b2.textContent.trim();
  document.querySelector('[data-dt=next]').click(); const r3=!!document.querySelector('.dt-chg');
  const col=getComputedStyle(b2||document.body).color;
  document.querySelector('.dt-x').click(); return {r1,r2,r3}; })`);
t('priceChange up renders ▲ with $ and %', /up\|▲ \$2\.25 \(\+22\.0%\) since Nov 11, 2026/.test(pcRes.r1), pcRes.r1);
t('priceChange down renders ▼', /down\|▼ \$1\.50 \(-14\.3%\)/.test(pcRes.r2), pcRes.r2);
t('no priceChange → nothing rendered', pcRes.r3 === false);
t('items without id do not touch the URL', (await hash()) === '');

// 6. back-to-top
await b.send('Page.navigate', { url: B + 'cards.html' }); await sleep(1500);
t('back-to-top hidden at top', (await b.ev(`getComputedStyle(document.querySelector('.btt')).visibility`)) === 'hidden');
await b.ev(`scrollTo(0, innerHeight*2.5)`); await sleep(400);
t('back-to-top appears after 2 screens', (await b.ev(`getComputedStyle(document.querySelector('.btt')).visibility`)) === 'visible');
await b.ev(`document.querySelector('.btt').click()`); await sleep(1200);
t('back-to-top scrolls to top and focuses the heading', (await b.ev(`scrollY`)) < 5 && (await b.ev(`document.activeElement.tagName`)) === 'H1');
await b.shot(`${out}/btt-desk.png`);

// 7. mobile: swipe + swipe-down close + btt above bottom nav
await b.viewport(390, 844, true, 2);
await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
await b.send('Page.navigate', { url: B + 'index.html' }); await sleep(1500);
await b.ev(`document.querySelector('#out .card-hit').click()`); await sleep(400);
const s0 = await title();
const swipe = async (x0, y0, x1, y1) => {
  await b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let k = 1; k <= 5; k++) { await b.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * k / 5, y: y0 + (y1 - y0) * k / 5 }] }); await sleep(16); }
  await b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
await swipe(300, 560, 90, 570); await sleep(350);
const s1 = await title();
t('swipe left → next card', s1 && s1 !== s0, `${s0} → ${s1}`);
await swipe(90, 560, 300, 565); await sleep(350);
t('swipe right → previous card', (await title()) === s0);
await swipe(195, 600, 195, 500); await sleep(300);
t('vertical drag up does not step or close', (await isOpen()) && (await title()) === s0);
await b.shot(`${out}/sheet-mob.png`);
await b.ev(`document.querySelector('.dt-in').scrollTop=0`); await sleep(100);
await swipe(195, 140, 195, 380); await sleep(500);
t('swipe down from the top closes the sheet on phones', !(await isOpen()) && (await hash()) === '');
await b.ev(`scrollTo(0, innerHeight*3)`); await sleep(400);
const r = await b.ev(`(()=>{const a=document.querySelector('.btt').getBoundingClientRect(), n=document.querySelector('.botnav').getBoundingClientRect(); return {btt:a.bottom, nav:n.top, w:a.width}})()`);
t('mobile back-to-top sits above the bottom nav, 44px', r.btt <= r.nav && r.w >= 44, JSON.stringify(r));
await b.shot(`${out}/btt-mob.png`);

collect();
const mine = errs.filter((e) => !/css\/(browse|lists|portfolio)\.css/.test(e));   // other agents' files in progress
t('no JS errors / failed requests (excluding other agents\' in-progress css)', mine.length === 0, mine.slice(0, 4).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
b.close(); process.exit(fail ? 1 : 0);
