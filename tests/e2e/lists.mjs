// Agent C: Wishlist + Sealed interaction tests + screenshots.
import { launch, sleep } from './cdp.mjs';
import { mkdirSync } from 'node:fs';
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const B = (process.env.BASE || 'http://localhost:5144/');
const b = await launch();
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${x ? '  — ' + x : ''}`); };
const errs = [];
const collect = () => { for (const e of b.events.splice(0)) {
  if (e.method === 'Runtime.exceptionThrown') errs.push(e.params.exceptionDetails.exception?.description?.slice(0, 160));
  if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') errs.push(e.params.args.map((a) => a.value).join(' '));
  if (e.method === 'Network.responseReceived' && e.params.response.status >= 400) errs.push(`HTTP ${e.params.response.status} ${e.params.response.url}`);
} };
const key = async (k, code, vk, text) => {
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, ...(text ? { text } : {}) });
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
};
const typeText = async (s) => { for (const ch of s) await b.send('Input.insertText', { text: ch }); };
const go = async (path, wait = 1400) => { await b.send('Page.navigate', { url: B + path }); await sleep(wait); };
const count = () => b.ev(`document.querySelectorAll('#out [data-i]').length`);
const realClick = async (sel) => {
  const p = await b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})()`);
  if (!p) return false;
  for (const type of ['mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type, x: p[0], y: p[1], button: 'left', clickCount: 1 });
  return true;
};

await b.viewport(1440, 900);
await go('wishlist.html', 300);
await b.ev(`localStorage.clear(); sessionStorage.clear()`);
await b.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: new URL(process.env.BASE || 'http://localhost:5144/').origin });
await go('wishlist.html');
const all = await count();
t('wishlist renders items', all > 50, `${all} rows`);

// 1. search + "/" + Esc
await b.ev(`document.body.focus(); document.activeElement.blur()`);
await key('/', 'Slash', 191, '/');
await sleep(100);
t('"/" focuses search', await b.ev(`document.activeElement.id==='q'`));
t('"/" is not typed into the box', (await b.ev(`document.getElementById('q').value`)) === '');
await typeText('pikachu'); await sleep(250);
const pk = await count();
const allPika = await b.ev(`[...document.querySelectorAll('#out [data-i] .wl-n')].every(n=>/pikachu/i.test(n.textContent))`);
t('search filters to matches', pk > 0 && pk < all && allPika, `${pk} rows, all Pikachu: ${allPika}`);
t('search reflected in URL', /[?&]q=pikachu/.test(await b.ev(`location.search`)));
await b.ev(`document.getElementById('q').value=''; document.getElementById('q').dispatchEvent(new Event('input'))`);
await b.ev(`document.getElementById('q').focus()`);
await typeText('023/128'); await sleep(200);
t('search by number', (await count()) === 1, await b.ev(`document.querySelector('#out .wl-n')?.textContent.trim().split('\\n')[0]`));
await b.ev(`document.getElementById('q').focus()`);
await key('Escape', 'Escape', 27); await sleep(200);
t('Esc clears search', (await b.ev(`document.getElementById('q').value`)) === '' && (await count()) === all);
await b.ev(`document.getElementById('q').value='Terastal'; document.getElementById('q').dispatchEvent(new Event('input'))`); await sleep(200);
t('search by set name', (await b.ev(`[...document.querySelectorAll('#out [data-i] .wl-s')].every(n=>/Terastal/i.test(n.textContent))`)) && (await count()) > 0, `${await count()} rows`);
await b.ev(`document.getElementById('q').value='zzzz-no-card'; document.getElementById('q').dispatchEvent(new Event('input'))`); await sleep(200);
t('no-match shows friendly empty state with clear button', await b.ev(`!!document.querySelector('#out .empty-st [data-clear]')`));
await realClick('#out .empty-st [data-clear]'); await sleep(250);
t('empty-state Clear filters restores the list', (await count()) === all && (await b.ev(`document.getElementById('q').value`)) === '');

// 2. Got-it on two items, then copy list excludes them
await realClick('#out .wl-row [data-got]'); await sleep(200);
const gotKey = await b.ev(`JSON.parse(localStorage.getItem('ptcg-got'))[0]`);
t('Got-it still toggles without opening the sheet', !!gotKey && !(await b.ev(`!!document.querySelector('dialog.dt[open]')`)), gotKey);
await b.ev(`document.getElementById('fSrc').value='want'; document.getElementById('fSrc').dispatchEvent(new Event('change'))`); await sleep(200);
const wantRows = await b.ev(`(()=>{const got=new Set(JSON.parse(localStorage.getItem('ptcg-got')||'[]'));
  return [...document.querySelectorAll('#out [data-i]')].length})()`);
await b.ev(`document.getElementById('fSrc').value='all'; document.getElementById('fSrc').dispatchEvent(new Event('change'))`); await sleep(200);
await b.ev(`document.getElementById('q').value='pikachu'; document.getElementById('q').dispatchEvent(new Event('input'))`); await sleep(200);
// mark the first shown pikachu that is NOT already got (the first row may be the card marked above)
await realClick('#out .wl-row:not(.got) [data-got]'); await sleep(200);
const gotName = await b.ev(`document.querySelector('#out .wl-row.got .wl-n')?.childNodes[0].textContent.trim()`);
const expect = await b.ev(`(()=>{const rows=[...document.querySelectorAll('#out .wl-row')].filter(r=>!r.classList.contains('got'));
  const prices=rows.map(r=>r.querySelector('.wl-pr').textContent.trim()).filter(p=>p.startsWith('$')).map(p=>+p.slice(1).replace(/,/g,''));
  return {n:rows.length, total:prices.reduce((a,b)=>a+b,0)}})()`);
await realClick('#copyBtn'); await sleep(500);
const clip = await b.ev(`navigator.clipboard.readText().catch(e=>'ERR '+e)`);
const lines = clip.split('\n').filter((l) => l.startsWith('- '));
t('copy: one line per shown, not-got card', lines.length === expect.n, `${lines.length} lines vs ${expect.n} rows`);
t('copy: excludes the "got" card', gotName && !clip.includes(`- ${gotName} `), gotName);
const m = clip.match(/Total: \$([\d,.]+)/);
t('copy: total matches the shown prices', m && Math.abs(+m[1].replace(/,/g, '') - expect.total) < 0.011, `${m && m[1]} vs ${expect.total.toFixed(2)}`);
t('copy: grouped under set headings', /\n\n30th Celebration: Pikachu Rares\n- Pikachu/.test(clip));
t('copy: polite toast confirms', await b.ev(`(()=>{const t=document.getElementById('toast');return t.classList.contains('show') && /Copied \\d+ card/.test(t.textContent) && t.getAttribute('aria-live')==='polite'})()`));
console.log('    clipboard head:\n      ' + clip.split('\n').slice(0, 4).join('\n      '));

// fallback path: break navigator.clipboard and copy again
await b.ev(`Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('blocked'))},configurable:true})`);
await b.ev(`document.addEventListener('copy',e=>{window.__fb=document.activeElement && document.activeElement.value},{once:true})`);
await realClick('#copyBtn'); await sleep(300);
const fb = await b.ev(`window.__fb||''`);
t('copy fallback (textarea + execCommand) carries the same text', fb === clip, `${fb.length} chars`);
t('fallback textarea removed afterwards', await b.ev(`!document.querySelector('.wl-copy-fallback')`));

// 3. budget plan correctness
await b.ev(`document.getElementById('q').value=''; document.getElementById('q').dispatchEvent(new Event('input'))`); await sleep(200);
await b.ev(`document.getElementById('fBudget').value='100'; document.getElementById('fBudget').dispatchEvent(new Event('input'))`); await sleep(300);
const plan = await b.ev(`(()=>{const P=r=>+r.querySelector('.wl-pr').textContent.trim().slice(1).replace(/,/g,'');
  const rows=[...document.querySelectorAll('#out .wl-row')];
  const inP=rows.filter(r=>r.classList.contains('in-plan')).map(P);
  const outP=rows.filter(r=>!r.classList.contains('in-plan') && !r.classList.contains('got') && r.querySelector('.wl-pr').textContent.trim().startsWith('$')).map(P);
  const sum=inP.reduce((a,b)=>a+b,0);
  return {n:inP.length, sum, maxIn:Math.max(...inP), minOut:Math.min(...outP), note:document.getElementById('budgetOut').textContent.replace(/\\s+/g,' ').trim(), gotIn: rows.some(r=>r.classList.contains('got')&&r.classList.contains('in-plan'))}})()`);
t('budget: picks sum ≤ budget', plan.n > 0 && plan.sum <= 100 + 1e-9, `${plan.n} cards, $${plan.sum.toFixed(2)}`);
t('budget: greedy cheapest-first (every pick ≤ every non-pick)', plan.maxIn <= plan.minOut, `max in $${plan.maxIn} ≤ min out $${plan.minOut}`);
t('budget: next cheapest would not fit', plan.sum + plan.minOut > 100, `$${plan.sum.toFixed(2)} + $${plan.minOut}`);
t('budget: got cards never in plan', !plan.gotIn);
t('budget: summary shows count + total + cheapest-first note', new RegExp(`${plan.n} of \\d+ cards for \\$${plan.sum.toFixed(2)}`).test(plan.note) && /cheapest-first/.test(plan.note), plan.note.slice(0, 120));
t('budget: copy button becomes "Copy budget list (n)"', (await b.ev(`document.getElementById('copyLab').textContent`)) === `Copy budget list (${plan.n})`);
await realClick('#copyBtn'); await sleep(400);
await b.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: new URL(process.env.BASE || 'http://localhost:5144/').origin });

// 4. max price helper
await b.ev(`document.getElementById('fMax').value='5'; document.getElementById('fMax').dispatchEvent(new Event('input'))`); await sleep(300);
const mx = await b.ev(`(()=>{const rows=[...document.querySelectorAll('#out .wl-row')];
  const ok=rows.every(r=>{const p=r.querySelector('.wl-pr').textContent.trim();return p.startsWith('$')&&+p.slice(1)<=5});
  return {ok, n:rows.filter(r=>!r.classList.contains('got')).length, note:document.querySelector('.wl-note').textContent.replace(/\\s+/g,' ').trim()}})()`);
t('max price: every row ≤ $5', mx.ok);
t('max price: note says how many fit + total', new RegExp(`^${mx.n} wanted cards? at \\$5 or less`).test(mx.note), mx.note);

// 5. persistence + URL round trip
await b.ev(`document.getElementById('vCards').click(); document.getElementById('fSort').value='cheap'; document.getElementById('fSort').dispatchEvent(new Event('change')); document.getElementById('fHide').click(); document.getElementById('fGroup').click()`);
await sleep(300);
const url = await b.ev(`location.search`);
t('URL reflects state', ['view=cards', 'sort=cheap', 'hide=1', 'group=0', 'max=5', 'budget=100'].every((s) => url.includes(s)), url);
await go('wishlist.html');   // no query → localStorage
const st = await b.ev(`({view:document.getElementById('vCards').getAttribute('aria-pressed'), sort:document.getElementById('fSort').value, hide:document.getElementById('fHide').getAttribute('aria-pressed'), group:document.getElementById('fGroup').getAttribute('aria-pressed'), max:document.getElementById('fMax').value, budget:document.getElementById('fBudget').value, grid:!!document.querySelector('#out .grid .wl-card')})`);
t('state restored from localStorage on a fresh visit', st.view === 'true' && st.sort === 'cheap' && st.hide === 'true' && st.group === 'false' && st.max === '5' && st.budget === '100' && st.grid, JSON.stringify(st));
await go('wishlist.html?view=list&sort=name&src=want');
const st2 = await b.ev(`({list:document.getElementById('vList').getAttribute('aria-pressed'), sort:document.getElementById('fSort').value, src:document.getElementById('fSrc').value})`);
t('URL query wins over saved state', st2.list === 'true' && st2.sort === 'name' && st2.src === 'want', JSON.stringify(st2));
await go('wishlist.html?sort=bogus&max=-3');
// a link's own settings are not saved, so invalid values fall back to the SAVED state (sort=cheap, max=5)
t('bad URL values fall back safely', (await b.ev(`document.getElementById('fSort').value`)) === 'cheap' && (await b.ev(`document.getElementById('fMax').value`)) === '5');
// clear filters button
await realClick('#clearBtn'); await sleep(300);
const cl = await b.ev(`({q:document.getElementById('q').value, src:document.getElementById('fSrc').value, max:document.getElementById('fMax').value, budget:document.getElementById('fBudget').value, hide:document.getElementById('fHide').getAttribute('aria-pressed'), disabled:document.getElementById('clearBtn').disabled, sort:document.getElementById('fSort').value})`);
t('Clear filters resets filters, keeps view/sort, then hides itself', cl.q === '' && cl.src === 'all' && cl.max === '' && cl.budget === '' && cl.hide === 'false' && cl.disabled && cl.sort === 'cheap', JSON.stringify(cl));

// 6. detail sheet still opens from rows and tiles
// works in either view (the saved view here is the card grid)
await realClick('#out [data-i] .wl-s, #out [data-i] .card-s'); await sleep(400);
t('row still opens the detail sheet', await b.ev(`!!document.querySelector('dialog.dt[open]')`), await b.ev(`document.getElementById('dt-title')?.textContent.trim()`));
await key('Escape', 'Escape', 27); await sleep(200);
t('"/" ignored while typing in another field', await b.ev(`(()=>{const m=document.getElementById('fMax'); m.focus(); return document.activeElement===m})()`));
await key('/', 'Slash', 191, '/'); await sleep(100);
t('…focus stays in that field', await b.ev(`document.activeElement.id==='fMax'`));
t('sprites still beside names', (await b.ev(`document.querySelectorAll('#out .name-sprite').length`)) > 10);

// 7. sealed
await go('sealed.html');
const s = await b.ev(`(()=>{const sh=document.querySelector('.sl-share'); return {share: sh && sh.querySelector('.stat-v').textContent, sub: sh && sh.querySelector('.stat-sub').textContent, rows:document.querySelectorAll('#out .sealed-row').length, head:document.getElementById('head').textContent.replace(/\\s+/g,' ').trim()}})()`);
const hist = await b.ev(`fetch('data/prices.json').then(r=>r.json()).then(p=>p.history[p.history.length-1])`);
const pct = Math.round(hist.sealed_total / hist.total * 100);
t('sealed: share of holdings matches prices.json history', s.share === `${pct}%`, `${s.share} vs ${pct}% (${hist.sealed_total}/${hist.total}) · ${s.sub}`);
t('sealed: rows render with share bars', s.rows === 6 && (await b.ev(`document.querySelectorAll('.sl-bar i').length`)) === 6);
const pcts = await b.ev(`[...document.querySelectorAll('.sl-pct')].map(x=>parseInt(x.textContent))`);
t('sealed: per-row % of sealed sums to ~100', Math.abs(pcts.reduce((a, b2) => a + b2, 0) - 100) <= 3, pcts.join('+'));
await b.ev(`document.getElementById('fSort').value='unit'; document.getElementById('fSort').dispatchEvent(new Event('change'))`); await sleep(200);
const units = await b.ev(`[...document.querySelectorAll('.sealed-unit')].map(x=>parseFloat(x.textContent.replace(/[$,]/g,'')))`);
t('sealed: unit sort is descending', units.every((v, i) => i === 0 || v <= units[i - 1]), units.join(' ≥ '));
t('sealed: active column marked', await b.ev(`document.querySelector('.sl-h-unit').classList.contains('on')`));
await go('sealed.html');
t('sealed: sort remembered', (await b.ev(`document.getElementById('fSort').value`)) === 'unit' && /sort=unit/.test(await b.ev(`location.search`)));
t('sealed: thumbnails 80px on desktop', (await b.ev(`document.querySelector('.sealed-img').getBoundingClientRect().width`)) === 80);
await realClick('#out .sealed-row .sealed-n'); await sleep(400);
t('sealed: row still opens the detail sheet', await b.ev(`!!document.querySelector('dialog.dt[open]')`));
await key('Escape', 'Escape', 27); await sleep(200);
await b.ev(`document.getElementById('fSort').value='value'; document.getElementById('fSort').dispatchEvent(new Event('change'))`);

// 8. transition still works from the wishlist
await go('wishlist.html');
await realClick('.nav a.tab[href="sealed.html"]'); await sleep(60);
t('Pokéball transition still fires', (await b.ev(`document.documentElement.className`)).includes('ball-leave'));
await sleep(1500);

// 9. screenshots + mobile checks
await b.ev(`localStorage.removeItem('ptcg-wish-ui'); localStorage.setItem('ptcg-got', JSON.stringify([]))`);
for (const [vw, vh, mob, tag] of [[1440, 900, false, 'desk'], [390, 844, true, 'mob']]) {
  await b.viewport(vw, vh, mob, mob ? 2 : 1);
  for (const pal of ['purple', 'green']) for (const theme of ['light', 'dark']) {
    await b.ev(`localStorage.setItem('ptcg-theme','${theme}'); localStorage.setItem('ptcg-palette','${pal}')`);
    await go('wishlist.html?budget=60&max=10', 1600);
    await b.shot(`${out}/wishlist-${tag}-${pal}-${theme}.png`);
    if (mob) t(`[${pal}/${theme}] wishlist: no sideways scroll at 390`, await b.ev(`document.documentElement.scrollWidth<=innerWidth`));
    await go('sealed.html', 1500);
    await b.shot(`${out}/sealed-${tag}-${pal}-${theme}.png`);
    if (mob) t(`[${pal}/${theme}] sealed: no sideways scroll at 390`, await b.ev(`document.documentElement.scrollWidth<=innerWidth`));
  }
  if (mob) {
    await go('wishlist.html', 1400);
    const small = await b.ev(`[...document.querySelectorAll('.wl-tools .btn:not(:disabled), .wl-tools input, #q')].filter(e=>e.offsetParent).map(e=>[e.id||e.className, Math.round(e.getBoundingClientRect().height)]).filter(([,h])=>h<44)`);
    t('mobile: new controls ≥ 44px tall', small.length === 0, JSON.stringify(small));
  }
}
// toast screenshot
await b.viewport(1440, 900); await b.ev(`localStorage.setItem('ptcg-theme','light'); localStorage.setItem('ptcg-palette','purple')`);
await go('wishlist.html?q=eevee');
await b.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: new URL(process.env.BASE || 'http://localhost:5144/').origin });
await realClick('#copyBtn'); await sleep(350);
await b.shot(`${out}/wishlist-toast.png`);

collect();
t('no console errors / failed requests', errs.length === 0, errs.slice(0, 4).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
b.close(); process.exit(fail ? 1 : 0);
