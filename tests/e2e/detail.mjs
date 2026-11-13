// Detail sheet tests: real clicks on every page, keyboard, links untouched.
import { launch, sleep } from './cdp.mjs';
import { mkdirSync } from 'node:fs';
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const B = (process.env.BASE || 'http://localhost:5144/');
const b = await launch();
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${x ? '  — ' + x : ''}`); };
const center = (sel) => b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; e.scrollIntoView({block:'center'});
  const r=e.getBoundingClientRect(); return [r.x+r.width/2, r.y+Math.min(r.height/2, 60)]})()`);
async function click(sel) {
  const p = await center(sel); if (!p) return false;
  await sleep(120);
  const q = await center(sel);
  for (const type of ['mousePressed', 'mouseReleased'])
    await b.send('Input.dispatchMouseEvent', { type, x: q[0], y: q[1], button: 'left', clickCount: 1 });
  return true;
}
const key = async (k, code) => {
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: { Escape: 27, ArrowRight: 39, ArrowLeft: 37 }[k] });
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code });
};
const isOpen = () => b.ev(`!!document.querySelector('dialog.dt[open]')`);
const title = () => b.ev(`document.querySelector('#dt-title')?.textContent.trim()`);
const errs = [];
const collect = () => { for (const e of b.events.splice(0)) {
  if (e.method === 'Runtime.exceptionThrown') errs.push(e.params.exceptionDetails.exception?.description);
  if (e.method === 'Network.responseReceived' && e.params.response.status >= 400) errs.push(`HTTP ${e.params.response.status} ${e.params.response.url}`);
} };

const cases = [
  ['index', '#out .card[data-i] .card-n', 'portfolio card'],
  ['cards', '#out .card[data-i] .card-s', 'cards grid card'],
  ['sets', '#out button.pk:not(.miss)', 'sets owned pocket'],
  ['sets', '#out button.pk.miss', 'sets missing pocket'],
  ['wishlist', '#out .wl-row[data-i] .wl-s', 'wishlist row'],
  ['sealed', '#out .sealed-row[data-i] .sealed-n', 'sealed row'],
];
for (const [vw, vh, mob, tag] of [[1440, 900, false, 'desk'], [390, 844, true, 'mob']]) {
  await b.viewport(vw, vh, mob, mob ? 2 : 1);
  for (const [pg, sel, name] of cases) {
    await b.send('Page.navigate', { url: B + pg + '.html' }); await sleep(1300);
    const expect = await b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});const h=e&&e.closest('[data-i]');
      return h ? (h.querySelector('.card-n,.pk-n,.wl-n,.sealed-n')||h).textContent.replace(/\\s+/g,' ').trim() : null})()`);
    await click(sel); await sleep(450);
    const tl = await title();
    t(`[${tag}] ${name}: click opens the sheet`, await isOpen(), tl);
    t(`[${tag}] ${name}: sheet shows the clicked item`, !!tl && !!expect && expect.toLowerCase().includes(tl.split(' ')[0].toLowerCase()), `${expect} → ${tl}`);
    const links = await b.ev(`[...document.querySelectorAll('.dt-link')].map(a=>a.textContent.trim().replace(/\\s*↗/,'')+'='+a.href.slice(0,40)).join(' | ')`);
    t(`[${tag}] ${name}: TCGplayer + PriceCharting links`, /TCGplayer=https:\/\/www\.tcgplayer\.com/.test(links) && /PriceCharting=https:\/\/www\.pricecharting\.com/.test(links), links);
    const imgOk = await b.ev(`(()=>{const i=document.querySelector('.dt-art img');return i? (i.complete&&i.naturalWidth>0) : 'placeholder'})()`);
    t(`[${tag}] ${name}: image loads`, imgOk === true || imgOk === 'placeholder', String(imgOk));
    t(`[${tag}] ${name}: sheet fits the viewport`, await b.ev(`(()=>{const r=document.querySelector('.dt-in').getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1})()`));
    if (pg === 'index' || pg === 'cards' || pg === 'sets') await b.shot(`${out}/${pg}-${name.replace(/\W+/g, '-')}-${tag}.png`);
    if (pg === 'sealed') await b.shot(`${out}/sealed-${tag}.png`);
    if (tag === 'desk' && pg === 'index') {
      await key('ArrowRight', 'ArrowRight'); await sleep(250);
      const t2 = await title();
      t('arrow → steps to the next card', t2 && t2 !== tl, `${tl} → ${t2}`);
      await key('ArrowLeft', 'ArrowLeft'); await sleep(250);
      t('arrow ← steps back', (await title()) === tl);
    }
    await key('Escape', 'Escape'); await sleep(250);
    t(`[${tag}] ${name}: Esc closes`, !(await isOpen()));
    t(`[${tag}] ${name}: scroll unlocked after close`, !(await b.ev(`document.documentElement.classList.contains('dt-open')`)));
  }
}
// links on the card itself still go straight out, without opening the sheet
await b.viewport(1440, 900);
await b.send('Page.navigate', { url: B + 'index.html' }); await sleep(1300);
const r = await b.ev(`(()=>{const a=document.querySelector('#out .card-lnks a'); let prevented=null;
  document.addEventListener('click',e=>{prevented=e.defaultPrevented; e.preventDefault()},{once:true});
  a.click(); return {prevented, open: !!document.querySelector('dialog.dt[open]'), href: a.href.slice(0,40)} })()`);
t('card TCGplayer link still opens directly, no sheet', r.prevented === false && !r.open, JSON.stringify(r));
await b.send('Page.navigate', { url: B + 'wishlist.html' }); await sleep(1300);
await click('#out .wl-row [data-got]'); await sleep(300);
t('wishlist "Got it" button toggles without opening the sheet', !(await isOpen()) && (await b.ev(`document.querySelector('#out .wl-row.got')!==null`)));
await b.ev(`localStorage.removeItem('ptcg-got')`);
// keyboard: Tab to a card's hit button and press Enter
await b.send('Page.navigate', { url: B + 'cards.html' }); await sleep(1300);
await b.ev(`document.querySelector('#out .card-hit').focus()`);
await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' }); await sleep(400);
t('keyboard: Enter on a focused card opens the sheet', await isOpen());
await key('Escape', 'Escape'); await sleep(250);
t('keyboard: focus returns to the card after closing', await b.ev(`document.activeElement && document.activeElement.classList.contains('card-hit')`));
// table view
await b.ev(`document.getElementById('vTable').click()`); await sleep(300);
await click('#out tr[data-i] td:nth-child(4)'); await sleep(400);
t('cards table: clicking a row opens the sheet', await isOpen(), await title());
collect();
t('no JS errors or failed requests', errs.length === 0, errs.slice(0, 4).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
b.close(); process.exit(fail ? 1 : 0);
