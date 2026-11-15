#!/usr/bin/env node
/* Fetch product shots for sealed product in data/sealed.json.

   Images are TCGplayer's own product photos, via the product records TCGCSV
   mirrors (same source as fetch-missing-images). A product is matched by its
   exact name (or with a bracketed variant dropped, as fetch-prices does),
   searched only within its own game's catalogue (data/games.json): the group
   named by its "set" first, then every group of that game.
   Saves images/sealed/s<id>.jpg and sets "image" on the entry.

   Usage:
     node scripts/fetch-sealed-images.mjs           # dry run
     node scripts/fetch-sealed-images.mjs --write   # download + update JSON
*/
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const P = (...a) => path.join(ROOT, ...a);
const BASE = 'https://tcgcsv.com/tcgplayer';
const WRITE = process.argv.includes('--write');
const UA = 'poke-tcg-tracker/1.0 (personal collection image sync)';
const OUT = P('images/sealed');

const j = async (u, tries = 3) => {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(u, { headers: { accept: 'application/json', 'user-agent': UA } });
      if (!r.ok) throw new Error(String(r.status));
      return await r.json();
    } catch (e) {
      if (i === tries) throw new Error(`${e.message} ${u}`);
      await new Promise((s) => setTimeout(s, 400 * i));
    }
  }
};
const rows = (o) => o.results ?? o;
const norm = (s) => String(s).toLowerCase()
  .replace(/[‘’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ')
  .replace(/\s+/g, ' ').trim();
const loose = (s) => s.replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+/g, ' ').trim();

const sealed = JSON.parse(await readFile(P('data/sealed.json'), 'utf8'));
const games = JSON.parse(await readFile(P('data/games.json'), 'utf8'));
const gameBy = new Map(games.map((g) => [g.key, g]));
const gameOf = (r) => (r && r.game) || 'pokemon';

/* Groups are per category, and a category belongs to one game, so a product
   shot is only ever looked for inside the game the entry says it is. Loaded
   lazily: a sync for Pokemon product never downloads the One Piece catalogue. */
const groupCache = new Map();
async function groupsOf(gameKey) {
  if (!groupCache.has(gameKey)) {
    const g = gameBy.get(gameKey);
    if (!g) { groupCache.set(gameKey, []); return []; }
    const all = [];
    for (const cat of Object.values(g.categories || {})) {
      try { for (const x of rows(await j(`${BASE}/${cat}/groups`))) all.push({ ...x, cat }); }
      catch {}
    }
    groupCache.set(gameKey, all);
  }
  return groupCache.get(gameKey);
}
const cache = new Map();
const productsOf = async (g) => {
  const ck = `${g.cat}/${g.groupId}`;
  if (!cache.has(ck)) {
    try { cache.set(ck, rows(await j(`${BASE}/${g.cat}/${g.groupId}/products`))); }
    catch { cache.set(ck, []); }
  }
  return cache.get(ck);
};
function pick(prods, s) {
  const want = norm(s.name);
  let hit = prods.filter((p) => norm(p.name) === want);
  if (!hit.length) hit = prods.filter((p) => norm(p.name) === loose(want));
  if (!hit.length && s.search_string) hit = prods.filter((p) => norm(p.name) === norm(s.search_string));
  return hit.find((p) => p.imageUrl) || null;
}

const found = [];
for (const s of sealed) {
  let hit = null;
  const groups = await groupsOf(gameOf(s));
  if (!groups.length) { console.log(`  (no catalogue for game "${gameOf(s)}") ${s.name}`); continue; }
  const own = groups.filter((g) => norm(g.name) === norm(s.set || ''));
  for (const g of own) { hit = pick(await productsOf(g), s); if (hit) break; }
  if (!hit) {
    for (const g of groups) { hit = pick(await productsOf(g), s); if (hit) break; }
  }
  if (hit) {
    found.push({ s, url: hit.imageUrl, productId: hit.productId });
    console.log(`  ✓ ${s.name}  →  product ${hit.productId}`);
  } else {
    console.log(`  (no match) ${s.name}`);
  }
}
console.log(`\nmatched ${found.length}/${sealed.length} sealed products`);
if (!WRITE) { console.log('Dry run - nothing downloaded. Re-run with --write.'); process.exit(0); }

await mkdir(OUT, { recursive: true });
let got = 0;
for (const f of found) {
  const file = `s${String(f.s.id).padStart(3, '0')}.jpg`;
  const dest = path.join(OUT, file);
  if (!existsSync(dest)) {
    // Prefer a sharper 400px shot; fall back to the URL TCGCSV gives (200px).
    let buf = null;
    for (const u of [f.url.replace(/_200w\.jpg$/, '_400w.jpg'), f.url]) {
      try {
        const r = await fetch(u, { headers: { 'user-agent': UA } });
        if (!r.ok) continue;
        const b = Buffer.from(await r.arrayBuffer());
        if (b.length > 900) { buf = b; break; }
      } catch {}
    }
    if (!buf) { console.log(`  ! ${f.s.name}: download failed`); continue; }
    await writeFile(dest, buf);
  }
  f.s.image = file;
  f.s.tcgplayer_id = f.productId;
  got++;
}
await writeFile(P('data/sealed.json'), JSON.stringify(sealed, null, 1) + '\n');
console.log(`✓ ${got} image(s) in images/sealed/, data/sealed.json updated`);
