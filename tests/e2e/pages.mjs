// Load pages in headless Chrome via CDP; report console errors, exceptions, failed requests.
// usage: node pagecheck.mjs <baseUrl>
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const base = process.argv[2];
const pages = ['index.html', 'cards.html', 'sealed.html', 'sets.html', 'wishlist.html'];
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const prof = mkdtempSync(path.join(os.tmpdir(), 'cdp-'));
const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${prof}`, '--no-first-run', ...(process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : []), 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 40 && !wsUrl; i++) {
  try { const t = await (await fetch('http://127.0.0.1:9333/json')).json(); wsUrl = t.find((x) => x.type === 'page')?.webSocketDebuggerUrl; } catch {}
  if (!wsUrl) await sleep(250);
}
if (!wsUrl) { console.error('no chrome'); proc.kill(); process.exit(2); }

const ws = new (globalThis.WebSocket ?? (await import('ws')).default)(wsUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const events = [];
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else events.push(d);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable'); await send('Page.enable');

let bad = 0;
for (const p of pages) {
  events.length = 0;
  await send('Page.navigate', { url: `${base}${p}` });
  await sleep(4000);
  const urls = {};
  const probs = [];
  for (const e of events) {
    if (e.method === 'Network.requestWillBeSent') urls[e.params.requestId] = e.params.request.url;
    if (e.method === 'Network.responseReceived' && e.params.response.status >= 400) probs.push(`HTTP ${e.params.response.status} ${e.params.response.url}`);
    if (e.method === 'Network.loadingFailed' && !e.params.canceled) probs.push(`FAILED ${urls[e.params.requestId]} ${e.params.errorText}`);
    if (e.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(e.params.type)) probs.push(`console.error ${e.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    if (e.method === 'Runtime.exceptionThrown') probs.push(`exception ${e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text}`);
    if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') probs.push(`log ${e.params.entry.text} ${e.params.entry.url ?? ''}`);
  }
  const r = await send('Runtime.evaluate', { expression: `JSON.stringify({title:document.title, css:getComputedStyle(document.body).backgroundColor, sheets:document.styleSheets.length, textLen:document.body.innerText.length, imgs:document.images.length})`, returnByValue: true });
  const reqs = Object.keys(urls).length;
  console.log(`${probs.length ? '✗' : '✓'} ${p}  requests=${reqs}  ${r.result.result.value}`);
  for (const x of [...new Set(probs)]) console.log('   ' + x);
  bad += probs.length;
}
ws.close(); proc.kill();
process.exit(bad ? 1 : 0);
