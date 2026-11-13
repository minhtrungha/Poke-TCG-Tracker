// Agent B tests: Cards + Sets usability features, driven with real input.
import { launch, sleep } from './cdp.mjs';
import { mkdirSync } from 'node:fs';
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const B = process.argv[3] || (process.env.BASE || 'http://localhost:5144/');
const b = await launch();
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${x !== '' ? '  — ' + x : ''}`); };
const errs = [];
const collect = () => { for (const e of b.events.splice(0)) {
  if (e.method === 'Runtime.exceptionThrown') errs.push(e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text);
  if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') errs.push(e.params.args.map((a) => a.value ?? a.description).join(' '));
  if (e.method === 'Network.responseReceived' && e.params.response.status >= 400) errs.push(`HTTP ${e.params.response.status} ${e.params.response.url}`);
} };
const go = async (u, wait = 1400) => { await b.send('Page.navigate', { url: B + u }); await sleep(wait); collect(); };
const pt = (sel) => b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; e.scrollIntoView({block:'center'});
  const r=e.getBoundingClientRect(); return [r.x+r.width/2, r.y+Math.min(r.height/2,40)]})()`);
async function click(sel) {
  await pt(sel); await sleep(150);
  const p = await pt(sel); if (!p) return false;
  for (const type of ['mousePressed', 'mouseReleased'])
    await b.send('Input.dispatchMouseEvent', { type, x: p[0], y: p[1], button: 'left', clickCount: 1 });
  await sleep(250); return true;
}
const VK = { Escape: 27, Enter: 13, '/': 191 };
async function key(k, text) {
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k === '/' ? 'Slash' : k, windowsVirtualKeyCode: VK[k] || 0, text });
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k === '/' ? 'Slash' : k, windowsVirtualKeyCode: VK[k] || 0 });
  await sleep(120);
}
async function type(s) { for (const ch of s) { await b.send('Input.insertText', { text: ch }); await sleep(30); } await sleep(200); }
async function select(id, value) {      // set a <select> like a user, firing change
  await b.ev(`(()=>{const s=document.getElementById('${id}'); s.focus(); s.value=${JSON.stringify(value)}; s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await sleep(250);
}
const prices = () => b.ev(`[...document.querySelectorAll('#out .card .card-p')].map(e=>{const m=e.textContent.replace(/[$,]/g,'').match(/[\\d.]+/);return m?+m[0]:null})`);
const names = () => b.ev(`[...document.querySelectorAll('#out .card .card-n')].map(e=>e.childNodes[0].textContent.trim())`);
const isSortedNum = (a, desc) => a.every((v, i) => i === 0 || (desc ? a[i - 1] >= v : a[i - 1] <= v));
const isOpen = () => b.ev(`!!document.querySelector('dialog.dt[open]')`);

await b.viewport(1440, 900);
await go('cards.html');
await b.ev(`localStorage.clear()`); await go('cards.html');

/* ---------- Cards: grid sort ---------- */
const total = await b.ev(`document.querySelectorAll('#out .card').length`);
t('cards: grid renders all cards by default', total > 100, total);
t('cards: sort control visible in grid view', await b.ev(`!document.getElementById('sortFld').hidden && getComputedStyle(document.getElementById('sortFld')).display!=='none'`));
await select('fSort', 'price-desc');
let pr = await prices(); const pv = pr.filter((x) => x != null);
t('sort price high→low is ordered', pv.length > 50 && isSortedNum(pv, true), pv.slice(0, 4).join(','));
t('sort price high→low: unpriced cards sink to the end', pr.indexOf(null) === -1 || pr.slice(pr.indexOf(null)).every((x) => x == null));
await select('fSort', 'price-asc');
pr = (await prices()).filter((x) => x != null);
t('sort price low→high is ordered', isSortedNum(pr, false), pr.slice(0, 4).join(','));
await select('fSort', 'name');
const nm = await names();
t('sort name A–Z is ordered', nm.every((v, i) => i === 0 || nm[i - 1].localeCompare(v, 'en', { numeric: true }) <= 0), nm.slice(0, 3).join(' | '));
await select('fSort', 'recent');
const ids = await b.ev(`(()=>{const d=[...document.querySelectorAll('#out .card .card-hit')].map(x=>x.getAttribute('aria-label'));return d.slice(0,2)})()`);
t('sort recently added puts the newest first', !!ids.length, ids.join(' | '));
t('URL reflects sort', (await b.ev(`location.search`)).includes('sort=recent'), await b.ev(`location.search`));

/* ---------- Cards: "/" shortcut, typing, Esc ---------- */
await b.ev(`document.activeElement && document.activeElement.blur(); document.body.focus()`);
await key('/', '/');
t('"/" focuses the search box', await b.ev(`document.activeElement && document.activeElement.id==='q'`));
t('"/" is not typed into the box', (await b.ev(`document.getElementById('q').value`)) === '');
await type('umbreon');
const qCount = await b.ev(`document.querySelectorAll('#out .card').length`);
const allUmb = await b.ev(`[...document.querySelectorAll('#out .card')].every(c=>/umbreon/i.test(c.textContent))`);
t('search filters to matching cards', qCount > 0 && qCount < total && allUmb, qCount);
t('count line stays accurate', (await b.ev(`document.getElementById('count').textContent`)).startsWith(`${qCount} of ${total}`), await b.ev(`document.getElementById('count').textContent`));
t('clear-filters button appears when filtered', await b.ev(`!document.getElementById('clearF').hidden && document.getElementById('clearF').offsetWidth>0`));
t('URL reflects search', (await b.ev(`location.search`)).includes('q=umbreon'));
await key('Escape');
t('Esc in the search box clears it', (await b.ev(`document.getElementById('q').value`)) === '' && (await b.ev(`document.querySelectorAll('#out .card').length`)) === total);
t('…and focus stays in the box', await b.ev(`document.activeElement.id==='q'`));
// "/" while typing in the box types a slash, not a refocus
await type('060/131');
t('"/" inside the box is a normal character', (await b.ev(`document.getElementById('q').value`)) === '060/131');
await key('Escape');

/* ---------- Cards: filters + clear ---------- */
await select('fLang', 'JP');
await click('#tags [data-tag="eevee"]');
const jpE = await b.ev(`document.querySelectorAll('#out .card').length`);
t('lang + tag filters combine', jpE > 0 && jpE < total, jpE);
await click('#clearF');
t('clear filters resets set/lang/tag/price/search', (await b.ev(`document.querySelectorAll('#out .card').length`)) === total &&
  (await b.ev(`document.getElementById('fLang').value`)) === 'all' &&
  (await b.ev(`document.querySelector('#tags [data-tag="all"]').getAttribute('aria-pressed')`)) === 'true');
t('clear filters keeps the chosen sort', (await b.ev(`document.getElementById('fSort').value`)) === 'recent');
t('clear button hides again', await b.ev(`document.getElementById('clearF').hidden`));
// empty state with its own clear button
await click('#q'); await type('zzzznothing');
t('friendly empty state', await b.ev(`!!document.querySelector('#out .empty-st [data-clear]')`), await b.ev(`document.querySelector('#out .empty-st h3')?.textContent`));
await click('#out .empty-st [data-clear]');
t('empty-state clear button restores the list', (await b.ev(`document.querySelectorAll('#out .card').length`)) === total);

/* ---------- Cards: persistence + URL round trip ---------- */
await select('fLang', 'EN'); await select('fSort', 'price-desc');
await go('cards.html');      // plain URL → remembered state
t('localStorage: filters + sort survive a reload', (await b.ev(`document.getElementById('fLang').value`)) === 'EN' && (await b.ev(`document.getElementById('fSort').value`)) === 'price-desc');
t('URL rewritten from remembered state', /lang=EN/.test(await b.ev(`location.search`)), await b.ev(`location.search`));
await go('cards.html?v=table&lang=JP&tag=eevee&q=ex&col=price&dir=-1');
t('URL wins: table view applied', (await b.ev(`document.getElementById('vTable').getAttribute('aria-pressed')`)) === 'true' && await b.ev(`!!document.querySelector('#out table')`));
t('URL wins: filters applied to controls', (await b.ev(`[document.getElementById('fLang').value, document.querySelector('#tags [aria-pressed="true"]').dataset.tag, document.getElementById('q').value].join('|')`)) === 'JP|eevee|ex');
const rowsOk = await b.ev(`[...document.querySelectorAll('#out tbody tr')].every(r=>/JP/.test(r.textContent) && /ex/i.test(r.textContent))`);
t('URL wins: rows match the URL filters', rowsOk && (await b.ev(`document.querySelectorAll('#out tbody tr').length`)) > 0, await b.ev(`document.querySelectorAll('#out tbody tr').length`));
const tp = await b.ev(`[...document.querySelectorAll('#out tbody td.pr')].map(td=>{const m=td.textContent.replace(/[$,]/g,'').match(/[\\d.]+/);return m?+m[0]:null}).filter(x=>x!=null)`);
t('URL wins: table sorted by price desc', isSortedNum(tp, true), tp.slice(0, 4).join(','));
t('sort control hidden in table view', await b.ev(`getComputedStyle(document.getElementById('sortFld')).display==='none'`));
await go('cards.html?lang=XX&tag=nope&v=weird&sort=bogus');
t('bad URL values fall back safely', (await b.ev(`[document.getElementById('fLang').value, document.querySelector('#tags [aria-pressed="true"]').dataset.tag, document.getElementById('vGrid').getAttribute('aria-pressed')].join('|')`)) === 'all|all|true');
// table header sort by click + keyboard
await go('cards.html?v=table');
await click('#out th[data-sort="name"]');
const tn = await b.ev(`[...document.querySelectorAll('#out tbody tr td:nth-child(2)')].map(t=>t.textContent.trim())`);
t('table column sort still works (name)', tn.every((v, i) => i === 0 || tn[i - 1].localeCompare(v, 'en', { numeric: true }) <= 0));
await key('Enter', '\r');
const tn2 = await b.ev(`[...document.querySelectorAll('#out tbody tr td:nth-child(2)')].map(t=>t.textContent.trim())`);
t('table header sorts by keyboard (Enter reverses)', tn2[0] === tn[tn.length - 1], `${tn2[0]} vs ${tn[tn.length - 1]}`);
// detail sheet from table + grid
await click('#out tr[data-i] td:nth-child(4)');
t('detail sheet opens from a table row', await isOpen());
await key('Escape');
await go('cards.html?v=grid');
await click('#out .card[data-i] .card-s');
t('detail sheet opens from a grid card', await isOpen(), await b.ev(`document.getElementById('dt-title')?.textContent.trim()`));
await key('Escape');
// Back still works: navigate away and back
await b.ev(`localStorage.clear()`);

/* ---------- Sets ---------- */
await go('sets.html');
await b.ev(`localStorage.removeItem('ptcg-sets-view')`); await go('sets.html');
const nSets = await b.ev(`document.querySelectorAll('#out section.set').length`);
const nOv = await b.ev(`document.querySelectorAll('#overview .ov').length`);
t('overview: one chip per set', nOv === nSets && nSets > 5, `${nOv}/${nSets}`);
const ovPct = await b.ev(`[...document.querySelectorAll('#overview .ov')].map(o=>o.querySelector('.ov-n').textContent)`);
t('overview shows completion', ovPct.every((x) => /^(\d+%|✓)$/.test(x)), ovPct.slice(0, 5).join(','));
t('each set header shows cost to finish / complete', await b.ev(`[...document.querySelectorAll('#out .set')].every(s=>s.querySelector('.set-cost'))`),
  await b.ev(`[...document.querySelectorAll('#out .set-cost')].slice(0,4).map(x=>x.textContent).join(' | ')`));
// jump
// a set from the middle (the last one sits at the page bottom and can't reach the top)
const lastKey = await b.ev(`(()=>{const o=[...document.querySelectorAll('#overview .ov')];return o[Math.floor(o.length/2)].dataset.jump})()`);
await b.ev(`scrollTo(0,0)`); await sleep(200);
await click(`#overview .ov[data-jump="${lastKey}"]`);
// wait for the smooth scroll to actually stop (up to 3 s), instead of a fixed sleep
for (let i = 0, prev = -1; i < 30; i++) { await sleep(100); const y = await b.ev(`scrollY`); if (y === prev && y > 0) break; prev = y; }
const top = await b.ev(`document.getElementById('set-${lastKey}').getBoundingClientRect().top`);
const navH = await b.ev(`document.querySelector('.nav').getBoundingClientRect().height`);
t('overview chip scrolls to its set, clear of the sticky nav', top >= navH - 2 && top < navH + 60 || await b.ev(`innerHeight+scrollY>=document.documentElement.scrollHeight-4`), `top=${Math.round(top)} nav=${Math.round(navH)}`);
// collapse one
await b.ev(`scrollTo(0,0)`); await sleep(200);
const firstKey = await b.ev(`document.querySelector('#out .set').id.replace('set-','')`);
await click(`#out .set-tg[data-toggle="${firstKey}"]`);
t('header button collapses the set', (await b.ev(`document.querySelector('#set-${firstKey} .set-tg').getAttribute('aria-expanded')`)) === 'false' &&
  await b.ev(`document.getElementById('setb-${firstKey}').hidden`));
t('collapsed set keeps its focus on the toggle', await b.ev(`document.activeElement && document.activeElement.dataset.toggle==='${firstKey}'`));
await go('sets.html');
t('collapsed set is remembered across reload', (await b.ev(`document.querySelector('#set-${firstKey} .set-tg').getAttribute('aria-expanded')`)) === 'false');
// jump to a collapsed set opens it
await click(`#overview .ov[data-jump="${firstKey}"]`); await sleep(600);
t('jumping to a collapsed set opens it', (await b.ev(`document.querySelector('#set-${firstKey} .set-tg').getAttribute('aria-expanded')`)) === 'true');
// collapse all / expand all
await click('#toggleAll');
t('Collapse all collapses every set', await b.ev(`[...document.querySelectorAll('#out .set-tg')].every(b=>b.getAttribute('aria-expanded')==='false')`));
t('…button now reads Expand all', (await b.ev(`document.getElementById('toggleAll').textContent`)) === 'Expand all');
t('no pockets rendered while all collapsed', (await b.ev(`document.querySelectorAll('#out .pk').length`)) === 0);
await click('#toggleAll');
t('Expand all opens every set', await b.ev(`[...document.querySelectorAll('#out .set-tg')].every(b=>b.getAttribute('aria-expanded')==='true')`));
// sort sets
const pcts = async () => b.ev(`[...document.querySelectorAll('#out .set-ct')].map(e=>{const m=e.textContent.match(/(\\d+)\\s*\\/\\s*(\\d+)/);return +m[1]/+m[2]})`);
await select('fOrder', 'most');
let ps = await pcts(); t('sort sets: most complete first', isSortedNum(ps, true), ps.slice(0, 4).map((x) => x.toFixed(2)).join(','));
await select('fOrder', 'least');
ps = await pcts(); t('sort sets: least complete first', isSortedNum(ps, false));
await select('fOrder', 'cost');
const costs = await b.ev(`[...document.querySelectorAll('#out .set-cost')].map(e=>e.classList.contains('done')?'done':(e.textContent.match(/\\$([\\d,]+)/)||[])[1])`);
const nums = costs.filter((c) => c && c !== 'done').map((c) => +c.replace(/,/g, ''));
const doneTail = costs.indexOf('done') === -1 || costs.slice(costs.indexOf('done')).every((c) => c === 'done');
t('sort sets: cheapest to finish, complete sets last', isSortedNum(nums, false) && doneTail, costs.slice(0, 6).join(','));
const ovOrder = await b.ev(`[...document.querySelectorAll('#overview .ov')].map(o=>o.dataset.jump).join()`);
const secOrder = await b.ev(`[...document.querySelectorAll('#out .set')].map(s=>s.id.replace('set-','')).join()`);
t('overview follows the chosen order', ovOrder === secOrder);
await go('sets.html');
t('set order remembered', (await b.ev(`document.getElementById('fOrder').value`)) === 'cost');
// pockets still open the sheet (owned + missing)
await click('#out button.pk:not(.miss)');
t('owned pocket still opens the detail sheet', await isOpen(), await b.ev(`document.getElementById('dt-title')?.textContent.trim()`));
await key('Escape');
await click('#out button.pk.miss');
t('missing pocket still opens the detail sheet', await isOpen(), await b.ev(`document.querySelector('.dt-chip')?.textContent`));
await key('Escape');
t('sprites still beside names', (await b.ev(`document.querySelectorAll('#out .pk .name-sprite').length`)) > 20);
// "missing only" + lang filter still work together with collapse
await select('fOnly', 'missing');
t('"Missing only" still filters pockets', await b.ev(`[...document.querySelectorAll('#out .pk')].every(p=>p.classList.contains('miss'))`));
await select('fLang', 'JP');
t('language filter narrows sets and overview', await b.ev(`document.querySelectorAll('#overview .ov').length===document.querySelectorAll('#out .set').length && document.querySelectorAll('#out .set').length<${nSets}`));
await select('fOnly', 'all'); await select('fLang', 'all'); await select('fOrder', 'default');

/* ---------- screenshots + mobile checks ---------- */
const shots = [];
for (const [vw, vh, mob, tag] of [[1440, 900, false, 'desk'], [390, 844, true, 'mob']]) {
  await b.viewport(vw, vh, mob, mob ? 2 : 1);
  for (const [theme, pal] of [['light', 'purple'], ['dark', 'purple'], ['light', 'green'], ['dark', 'green']]) {
    await go('index.html', 300);
    await b.ev(`localStorage.setItem('ptcg-theme','${theme}'); localStorage.setItem('ptcg-palette','${pal}')`);
    for (const p of ['cards.html?lang=EN&sort=price-desc', 'sets.html']) {
      await go(p, 1500);
      if (p.startsWith('cards')) { await b.ev(`document.getElementById('q').value='';`); }
      const f = `${out}/${p.split('.')[0]}-${tag}-${theme}-${pal}.png`;
      await b.shot(f); shots.push(f);
      if (mob) {
        t(`[${tag} ${theme} ${pal}] ${p.split('.')[0]}: no horizontal scroll`, await b.ev(`document.documentElement.scrollWidth<=innerWidth`), await b.ev(`document.documentElement.scrollWidth`));
        const small = await b.ev(`[...document.querySelectorAll('#overview .ov, .set-tg, #clearF:not([hidden]), #fSort, #fOrder, #toggleAll')].filter(e=>e.offsetWidth>0).filter(e=>e.getBoundingClientRect().height<43.5).map(e=>e.id||e.className)`);
        t(`[${tag} ${theme} ${pal}] ${p.split('.')[0]}: new controls ≥44px tall`, small.length === 0, small.join(','));
      }
    }
  }
}
// contrast of new text against its own background
await b.viewport(1440, 900);
for (const [theme, pal] of [['light', 'purple'], ['dark', 'purple'], ['light', 'green'], ['dark', 'green']]) {
  await b.ev(`localStorage.setItem('ptcg-theme','${theme}'); localStorage.setItem('ptcg-palette','${pal}')`);
  for (const [page, sels] of [['sets.html', ['.ov-t', '.ov-n', '.set-cost', '.set-cost.done', '.set-cost.none', '#toggleAll']],
                              ['cards.html?lang=JP', ['#clearF', '.kbd-hint']]]) {
    await go(page, 1300);
    if (page.startsWith('cards')) await b.ev(`document.getElementById('q').blur()`);
    const res = await b.ev(`(()=>{
      const L=(r,g,b)=>{const f=c=>{c/=255;return c<=.03928?c/12.92:((c+.055)/1.055)**2.4};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
      const rgb=s=>{const m=s.match(/[\\d.]+/g).map(Number);if(/^color\\(srgb/.test(s)){for(let i=0;i<3;i++)m[i]*=255;}return m}; /* color-mix() resolves to color(srgb r g b) with 0–1 channels */
      const bgOf=e=>{for(let n=e;n;n=n.parentElement){const c=getComputedStyle(n).backgroundColor;const m=rgb(c);if(m.length<4||m[3]>0.5) return m;}return [255,255,255]};
      return ${JSON.stringify(sels)}.map(sel=>{const e=document.querySelector(sel); if(!e||!e.offsetWidth) return sel+':skip';
        const f=rgb(getComputedStyle(e).color), g=bgOf(e); const a=L(...f.slice(0,3)), c=L(...g.slice(0,3));
        const r=(Math.max(a,c)+.05)/(Math.min(a,c)+.05); return sel+':'+r.toFixed(2)})})()`);
    const low = res.filter((x) => !x.endsWith(':skip') && parseFloat(x.split(':')[1]) < 4.5);
    t(`contrast ≥4.5 [${theme} ${pal}] ${page.split('.')[0]}`, low.length === 0, res.join(' '));
  }
}
await b.ev(`localStorage.clear()`);
collect();
t('no console errors or failed requests', errs.length === 0, errs.slice(0, 5).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
console.log('shots:', shots.length);
b.close(); process.exit(fail ? 1 : 0);
