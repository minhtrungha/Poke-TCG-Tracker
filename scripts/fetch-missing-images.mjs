#!/usr/bin/env node
/* Fetch card images for cards the owner does NOT own yet - the empty set slots
   in data/sets.json and the standalone wants in data/wishlist.json - so the
   Sets and Wishlist pages can show what the card looks like.

   Images come from the TCGplayer CDN, via the product records TCGCSV mirrors.
   They are the marketplace's own product shots, the same ones a listing shows.

   Owned cards keep the owner's own photos; this script never touches those.

   Usage:
     node scripts/fetch-missing-images.mjs           # dry run
     node scripts/fetch-missing-images.mjs --write   # download
*/
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const P = (...a) => path.join(ROOT, ...a);
const BASE = 'https://tcgcsv.com/tcgplayer';
const CAT = { EN: 3, JP: 85 };
const WRITE = process.argv.includes('--write');
const UA = 'poke-tcg-tracker/1.0 (personal collection image sync)';
const OUT = P('images/need');

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

const normNum = (s) => String(s ?? '').trim().toUpperCase()
  .replace(/\s+/g, ' ').replace(/^([A-Z]{2,4})\s*0*(\d+)$/, '$1 $2');
const numKey = (s) => {
  const n = normNum(s);
  const m = n.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return `${String(+m[1])}/${String(+m[2])}`;
  const p = n.match(/^([A-Z]{2,4})\s*(\d+)$/);
  if (p) return `${p[1]} ${+p[2]}`;
  if (/^\d+$/.test(n)) return String(+n);
  return n;
};
const prodNum = (p) => {
  for (const e of p.extendedData ?? []) if (e.name === 'Number') return e.value;
  const m = String(p.name).match(/-\s*([A-Z]*\s*[\d/]+)\s*$/i);
  return m ? m[1] : '';
};
const baseName = (s) => String(s).split(' - ')[0]
  .replace(/\s*\([^)]*\)\s*/g, ' ').replace(/-/g, ' ')
  .replace(/\s+/g, ' ').trim().toLowerCase();

/* --- what do we need an image for? ----------------------------------- */
const sets = JSON.parse(await readFile(P('data/sets.json'), 'utf8'));
const wish = JSON.parse(await readFile(P('data/wishlist.json'), 'utf8'));
let aliases = {};
try { aliases = JSON.parse(await readFile(P('data/aliases.json'), 'utf8')); } catch {}

const need = [];
for (const s of sets) {
  for (const sl of s.slots) {
    if (sl.card_id != null) continue;
    need.push({
      kind: 'slot', setKey: s.key, set: s.name, lang: s.lang || 'EN',
      name: sl.name, number: sl.number,
      file: `${s.key}-${String(sl.number).replace(/[^A-Za-z0-9]/g, '_')}.jpg`,
    });
  }
}
for (const w of wish) {
  if (w.owned) continue;
  need.push({
    kind: 'want', set: w.set, lang: w.lang || 'EN',
    name: w.name, number: w.number,
    file: `want-${String(w.name).replace(/[^A-Za-z0-9]/g, '_')}-${String(w.number).replace(/[^A-Za-z0-9]/g, '_')}.jpg`,
  });
}
console.log(`need images for ${need.length} cards (${need.filter((n) => n.kind === 'slot').length} set slots, ${need.filter((n) => n.kind === 'want').length} wants)`);

/* --- build catalogue for the languages we actually need --------------- */
const langs = [...new Set(need.map((n) => (n.lang === 'JP' ? 'JP' : 'EN')))];
const catalogue = {};
for (const lang of langs) {
  process.stderr.write(`loading ${lang} catalogue...\n`);
  const groups = rows(await j(`${BASE}/${CAT[lang]}/groups`));
  const byNum = new Map();
  let done = 0;
  for (const g of groups) {
    let prods;
    try { prods = await j(`${BASE}/${CAT[lang]}/${g.groupId}/products`); } catch { continue; }
    for (const p of rows(prods)) {
      if (!p.imageUrl) continue;
      const k = numKey(prodNum(p));
      if (!k) continue;
      if (!byNum.has(k)) byNum.set(k, []);
      byNum.get(k).push({ name: p.name, base: baseName(p.name), group: g.name, img: p.imageUrl });
    }
    if (++done % 60 === 0) process.stderr.write(`  ${done}/${groups.length}\n`);
  }
  catalogue[lang] = byNum;
  process.stderr.write(`  ${lang}: ${byNum.size} numbers\n`);
}

/* --- match --------------------------------------------------------- */
const STOP = new Set(['the', 'and', 'ex', 'gx', 'pokemon', 'pokémon', 'card',
  'black', 'star', 'promos', 'promo', 'collection', 'set', 'sv', 'tcg']);
const found = [], missing = [];
for (const n of need) {
  // A verified alias names the exact upstream product, so use it directly.
  const al = n.kind === 'slot' ? aliases[`${n.setKey}|${String(n.number).trim().toUpperCase()}`] : null;
  if (al) {
    const idxA = catalogue[n.lang === 'JP' ? 'JP' : 'EN'];
    let hit = null;
    for (const list of idxA.values()) {
      const m = list.find((x) => x.name === al.product);
      if (m) { hit = m; break; }
    }
    if (hit) { found.push({ ...n, img: hit.img.replace(/_\d+w\.jpg$/, '_400w.jpg'), prod: hit.name }); continue; }
  }
  const idx = catalogue[n.lang === 'JP' ? 'JP' : 'EN'];
  const keys = [numKey(n.number)];
  const pfx = normNum(n.number).match(/^([A-Z]{2,4})\s*(\d+)$/);
  if (pfx) keys.push(String(+pfx[2]));
  const frac = normNum(n.number).match(/^(\d+)\s*\/\s*\d+$/);
  if (frac) keys.push(String(+frac[1]));
  let cands = [];
  for (const k of keys) { const g = idx.get(k); if (g && g.length) { cands = g; break; } }
  // Older sets store "12/116" where the wishlist records a bare "12". Scan for
  // any "<n>/<total>" whose numerator matches, then let set-word scoring below
  // pick the right set - a bare number alone is far too ambiguous.
  // Older sets store "12/116" where the wishlist records a bare "12", and a
  // bare "12" may also exist in an unrelated set. Always add the "<n>/<total>"
  // candidates so set-word scoring can choose between them.
  let wideScan = false;
  if (/^\d+$/.test(normNum(n.number))) {
    const want = String(+normNum(n.number));
    const before = cands.length;
    for (const [k, v] of idx) {
      if (k.startsWith(`${want}/`)) cands = cands.concat(v);
    }
    wideScan = cands.length > before || before === 0;
  }
  // Slot labels can carry a sequence suffix that is not part of the card name,
  // e.g. "Pikachu 01/30" or "Eevee ex (alt)". Try the label, then the bare name.
  const names = [baseName(n.name)];
  const bare = baseName(String(n.name).replace(/\s*\d+\s*\/\s*\d+\s*$/, ''));
  if (bare && bare !== names[0]) names.push(bare);
  let pick = [];
  for (const nm of names) {
    pick = cands.filter((x) => x.base === nm);
    if (pick.length) break;
  }
  if (!pick.length) { missing.push(n); continue; }
  const words = String(n.set).toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
  if (pick.length > 1 || wideScan) {
    const scored = pick.map((x) => ({ x, s: words.filter((w) => x.group.toLowerCase().includes(w)).length }));
    const best = Math.max(...scored.map((v) => v.s));
    // A wide scan matched on numerator alone, so an unconfirmed set would be a
    // guess: skip it rather than show the wrong card's art.
    if (best === 0 && wideScan) { missing.push(n); continue; }
    if (best > 0) pick = scored.filter((v) => v.s === best).map((v) => v.x);
  }
  found.push({ ...n, img: pick[0].img.replace(/_\d+w\.jpg$/, '_400w.jpg'), prod: pick[0].name });
}

console.log(`matched ${found.length}/${need.length}; no product image for ${missing.length}`);
if (missing.length) {
  for (const m of missing.slice(0, 25)) console.log(`  - ${m.name} ${m.number} [${m.lang}] ${m.set}`);
  if (missing.length > 25) console.log(`  ...and ${missing.length - 25} more`);
}

if (!WRITE) { console.log('\nDry run - nothing downloaded. Re-run with --write.'); process.exit(0); }

/* --- download ------------------------------------------------------- */
await mkdir(OUT, { recursive: true });
const map = {};
let got = 0, failed = 0;
for (const f of found) {
  const dest = path.join(OUT, f.file);
  // Key slots by the number EXACTLY as sets.json records it. normNum() turns
  // "SM146" into "SM 146", which the site then fails to look up.
  const key = f.kind === 'slot'
    ? `${f.setKey}|${String(f.number).trim().toUpperCase()}`
    : `want|${f.name}|${normNum(f.number)}`;
  if (existsSync(dest)) { map[key] = f.file; got++; continue; }
  try {
    const r = await fetch(f.img, { headers: { 'user-agent': UA } });
    if (!r.ok) throw new Error(String(r.status));
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 900) throw new Error('too small');
    await writeFile(dest, buf);
    map[key] = f.file;
    if (++got % 25 === 0) process.stderr.write(`  ${got}/${found.length}\n`);
  } catch (e) {
    failed++;
    console.log(`  ! ${f.name} ${f.number}: ${e.message}`);
  }
  await new Promise((s) => setTimeout(s, 90));   // be polite to the CDN
}
await writeFile(P('data/need-images.json'), JSON.stringify(map, null, 1) + '\n');
console.log(`\n✓ ${got} images in images/need/, ${failed} failed`);
console.log(`✓ wrote data/need-images.json (${Object.keys(map).length} entries)`);
