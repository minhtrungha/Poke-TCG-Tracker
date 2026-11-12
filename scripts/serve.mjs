#!/usr/bin/env node
/* Minimal static server for previewing dist/ (ES modules need http://, not file://). */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.join(path.resolve(import.meta.dirname, '..'), 'dist');
const port = Number(process.env.PORT) || 5144;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const fp = path.join(root, path.normalize(rel));
    if (!fp.startsWith(root)) { res.writeHead(403).end('Forbidden'); return; }
    let f = fp;
    try { if ((await stat(f)).isDirectory()) f = path.join(f, 'index.html'); }
    catch { if (!path.extname(f)) f = fp + '.html'; }
    const body = await readFile(f);
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
       .end('<h1>404</h1><p>Run <code>npm run build</code> first.</p>');
  }
}).listen(port, () => console.log(`\n  Poké TCG Tracker → http://localhost:${port}\n`));
