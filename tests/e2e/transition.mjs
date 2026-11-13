// Behavioural tests for the Pokéball transition, driven through real clicks.
import { launch, sleep } from './cdp.mjs';
const B = process.argv[2] || (process.env.BASE || 'http://localhost:5144/');
const b = await launch();
let pass = 0, fail = 0;
const t = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${extra ? '  — ' + extra : ''}`); };
const cls = () => b.ev(`document.documentElement.className`);
const page = () => b.ev(`location.pathname.split('/').pop()`);
const waitFor = async (expr, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await b.ev(expr)) return Date.now() - t0; await sleep(25); } return -1; };
const clickSel = (sel) => b.ev(`(()=>{const a=document.querySelector(${JSON.stringify(sel)}); if(!a) return 'missing';
  const r=a.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})()`);
async function realClick(sel, mods = 0) {
  const p = await clickSel(sel); if (!Array.isArray(p)) return p;
  const [x, y] = p;
  await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, modifiers: mods });
  await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, modifiers: mods });
  return 'ok';
}
const errs = [];
const collect = () => { for (const e of b.events.splice(0)) {
  if (e.method === 'Runtime.exceptionThrown') errs.push(e.params.exceptionDetails.exception?.description);
  if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') errs.push(e.params.args.map((a) => a.value).join(' '));
  if (e.method === 'Network.responseReceived' && e.params.response.status >= 400) errs.push(`HTTP ${e.params.response.status} ${e.params.response.url}`);
} };

await b.viewport(1440, 900);
await b.send('Page.navigate', { url: B + 'index.html' }); await sleep(1500);
t('first load has no ball (direct visit)', !(await cls()).includes('ball'));

// 1. desktop tab click
const t0 = Date.now();
await realClick('.nav a.tab[href="cards.html"]');
await sleep(60);
t('click shuts the ball before leaving', (await cls()).includes('ball-leave'));
await waitFor(`location.pathname.endsWith('cards.html') && document.readyState!=='loading'`);
const arrived = await b.ev(`document.documentElement.classList.contains('ball-arrive')`);
t('next page arrives with ball-arrive (covered first paint)', arrived);
t('sessionStorage flag consumed', (await b.ev(`sessionStorage.getItem('ptcg-ball')`)) === null);
const open = await waitFor(`!document.documentElement.className.includes('ball')`, 3000);
t('ball opens and cleans up', open >= 0, `fully open ~${Date.now() - t0} ms after click`);
t('page content rendered', (await b.ev(`document.querySelectorAll('#out .card, #out tr').length`)) > 10);

// 2. clicking the current tab is a no-op
await realClick('.nav a.tab[aria-current="page"]'); await sleep(400);
t('current tab click: no transition, no reload', !(await cls()).includes('ball') && (await page()) === 'cards.html');

// 3. back button / bfcache
await realClick('.nav a.tab[href="sets.html"]');
await waitFor(`location.pathname.endsWith('sets.html')`); await waitFor(`!document.documentElement.className.includes('ball')`, 3000);
await b.ev(`history.back()`); await waitFor(`location.pathname.endsWith('cards.html')`); await sleep(900);
t('back button: page is not left covered', !(await cls()).includes('ball-leave'), `class="${await cls()}"`);
const covered = await b.ev(`(()=>{const s=getComputedStyle(document.documentElement,'::before');return s.content!=='none' && s.visibility!=='hidden' && s.opacity!=='0'})()`);
t('back button: no overlay visible', !covered, String(covered));

// 4. modifier click (cmd/ctrl) not intercepted
const intercepted = await b.ev(`(()=>{const a=document.querySelector('.nav a.tab[href="index.html"]');
  const ev=new MouseEvent('click',{bubbles:true,cancelable:true,metaKey:true,button:0});
  let prevented=null; document.addEventListener('click',e=>{prevented=e.defaultPrevented;e.preventDefault()},{once:true});
  a.dispatchEvent(ev); return prevented})()`);
t('cmd-click is left to the browser (new tab)', intercepted === false);
t('cmd-click did not start the ball', !(await cls()).includes('ball'));

// 5. external link not intercepted
const ext = await b.ev(`(()=>{const a=document.createElement('a');a.href='https://www.tcgplayer.com/';a.textContent='x';document.body.append(a);
  let prevented=null; document.addEventListener('click',e=>{prevented=e.defaultPrevented;e.preventDefault()},{once:true});
  a.click(); a.remove(); return prevented})()`);
t('external link not intercepted', ext === false && !(await cls()).includes('ball'));

// 6. in-content link (Portfolio "Sealed →") also transitions
await b.send('Page.navigate', { url: B + 'index.html' }); await sleep(1500);
await realClick('a.stat-link');
await sleep(60);
t('in-page link to another tab also uses the ball', (await cls()).includes('ball-leave'));
await waitFor(`location.pathname.endsWith('sealed.html')`); await waitFor(`!document.documentElement.className.includes('ball')`, 3000);

// 7. reduced motion
await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await realClick('.nav a.tab[href="wishlist.html"]'); await sleep(40);
const rmCls = await cls();
await waitFor(`location.pathname.endsWith('wishlist.html')`); await sleep(300);
t('reduced motion: plain navigation, no ball either side', !rmCls.includes('ball') && !(await cls()).includes('ball'));
await b.send('Emulation.setEmulatedMedia', { features: [] });

// 8. mobile bottom nav
await b.viewport(390, 844, true, 2);
await b.send('Page.navigate', { url: B + 'sets.html' }); await sleep(1500);
await realClick('.botnav a[href="index.html"]'); await sleep(60);
t('mobile bottom nav: ball shuts', (await cls()).includes('ball-leave'));
await waitFor(`location.pathname.endsWith('index.html')`);
t('mobile: arrives open and clean', (await waitFor(`!document.documentElement.className.includes('ball')`, 3000)) >= 0);
t('mobile: no sideways scroll', await b.ev(`document.documentElement.scrollWidth<=innerWidth`));

// 9. failure safety: arrival class with no JS at all still opens (pure CSS)
await b.send('Emulation.setScriptExecutionDisabled', { value: true });
await b.send('Page.navigate', { url: B + 'sets.html' }); await sleep(900);
await b.send('Emulation.setScriptExecutionDisabled', { value: false });
await b.ev(`document.documentElement.classList.add('ball-arrive'); for (const a of document.getAnimations()) {}`);
await sleep(900);
const st = await b.ev(`['::before','::after'].map(p=>getComputedStyle(document.documentElement,p).transform).join(' ')`);
t('without the JS cleanup the CSS still opens the ball (halves slid off)', /matrix\(1, 0, 0, 1, 0, -\d+.*matrix\(1, 0, 0, 1, 0, \d+/.test(st), st);

collect();
t('no console errors or failed requests', errs.length === 0, errs.slice(0, 5).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
b.close(); process.exit(fail ? 1 : 0);
