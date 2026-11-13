// Minimal CDP driver for headless Chrome. Node 20: run with --experimental-websocket.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch() {
  const port = 9400 + Math.floor(Math.random() * 500);   // fresh port: never attach to a stale browser
  const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const prof = mkdtempSync(path.join(os.tmpdir(), 'cdp-'));
  const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`,
    '--no-first-run', '--hide-scrollbars',
    ...(process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : []), 'about:blank'], { stdio: 'ignore' });
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); wsUrl = t.find((x) => x.type === 'page')?.webSocketDebuggerUrl; } catch {}
    if (!wsUrl) await sleep(200);
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(); const events = [];
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else events.push(d);
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  const viewport = (w, h, mobile = false, dpr = 1) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile });
  const shot = async (file, full = false) => {
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full });
    writeFileSync(file, Buffer.from(r.result.data, 'base64'));
  };
  // Always delete the throwaway profile: each one caches ~90 MB of site images.
  const close = () => {
    try { ws.close(); } catch {}
    proc.once('exit', () => { try { rmSync(prof, { recursive: true, force: true }); } catch {} });
    proc.kill();
  };
  return { send, ev, viewport, shot, close, events };
}
