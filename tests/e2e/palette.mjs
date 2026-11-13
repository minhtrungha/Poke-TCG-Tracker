// Green palette: screenshots + toggle behaviour.
import { launch, sleep } from './cdp.mjs';
import { mkdirSync } from 'node:fs';
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const B = (process.env.BASE || 'http://localhost:5144/');
const b = await launch();
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${x ? '  — ' + x : ''}`); };
const set = (theme, pal) => b.ev(`localStorage.setItem('ptcg-theme','${theme}'); localStorage.setItem('ptcg-palette','${pal}')`);

await b.viewport(1440, 900);
await b.send('Page.navigate', { url: B + 'index.html' }); await sleep(800);
await set('light', 'purple');
await b.send('Page.navigate', { url: B + 'index.html' }); await sleep(1500);
t('default is purple', (await b.ev(`document.documentElement.dataset.palette||'purple'`)) === 'purple');
const before = await b.ev(`getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()`);
await b.ev(`document.getElementById('palBtn').click()`); await sleep(400);
const after = await b.ev(`getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()`);
t('leaf button switches to green', (await b.ev(`document.documentElement.dataset.palette`)) === 'green', `${before} → ${after}`);
t('choice is saved', (await b.ev(`localStorage.getItem('ptcg-palette')`)) === 'green');
t('button label says what it does next', /purple/.test(await b.ev(`document.getElementById('palBtn').getAttribute('aria-label')`)));
t('browser bar colour follows', (await b.ev(`document.querySelector('meta[name=theme-color]').content`)) === '#d6f3dd');
await b.send('Page.navigate', { url: B + 'cards.html' }); await sleep(1500);
t('green persists to the next page, before first paint', (await b.ev(`document.documentElement.dataset.palette`)) === 'green');
const wall = await b.ev(`getComputedStyle(document.body,'::before').backgroundImage`);
t('green wallpaper in use', /bg-wide-green/.test(wall));
t('theme toggle still independent', await b.ev(`(()=>{document.getElementById('themeBtn').click(); const r=document.documentElement.dataset.theme==='dark' && document.documentElement.dataset.palette==='green'; document.getElementById('themeBtn').click(); return r})()`));

for (const [vw, vh, mob, tag] of [[1440, 900, false, 'desk'], [390, 844, true, 'mob']]) {
  await b.viewport(vw, vh, mob, mob ? 2 : 1);
  for (const theme of ['light', 'dark']) {
    await set(theme, 'green');
    for (const p of ['index', 'sets']) {
      await b.send('Page.navigate', { url: B + p + '.html' }); await sleep(1700);
      await b.shot(`${out}/${p}-${tag}-${theme}.png`);
    }
    if (tag === 'mob') t(`[${theme}] portrait green wallpaper on phones`, /bg-portrait-green/.test(await b.ev(`getComputedStyle(document.body,'::before').backgroundImage`)));
  }
}
await b.viewport(1440, 900); await set('light', 'green');
await b.send('Page.navigate', { url: B + 'index.html' }); await sleep(1500);
await b.ev(`document.querySelector('#out .card-hit').click()`); await sleep(500);
await b.shot(`${out}/detail-green.png`);
await b.viewport(390, 844, true, 2); await b.send('Page.navigate', { url: B + 'wishlist.html' }); await sleep(1500);
t('green, phone: no sideways scroll', await b.ev('document.documentElement.scrollWidth<=innerWidth'));
console.log(`\n${pass} passed, ${fail} failed`);
await set('light', 'purple');
b.close(); process.exit(fail ? 1 : 0);
