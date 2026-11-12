#!/usr/bin/env node
/* Download the box sprites this collection actually needs from PokéSprite,
   and write data/sprites.json mapping a card name to its sprite file.

   Only the species present in the collection are fetched - not all 900+.
   Sprites are DECORATIVE: they never replace a card photo or NEED art.

   Licence note: PokéSprite's code and data are MIT, but the sprite images
   remain (c) Nintendo / Creatures Inc. / GAME FREAK Inc. The owner has
   accepted that for this private, non-commercial tracker. See docs/CREDITS.md.

   Usage:
     node scripts/fetch-sprites.mjs           # dry run: report coverage
     node scripts/fetch-sprites.mjs --write   # download into images/sprites/
*/
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const P = (...a) => path.join(ROOT, ...a);
const WRITE = process.argv.includes('--write');
const UA = 'poke-tcg-tracker/1.0 (personal collection sprite sync)';
const DEX_URL = 'https://raw.githubusercontent.com/msikma/pokesprite/master/data/pokemon.json';
const SPRITE_BASE = 'https://raw.githubusercontent.com/msikma/pokesprite/master/pokemon-gen8/regular';
const OUT = P('images/sprites');

const cards = JSON.parse(await readFile(P('data/cards.json'), 'utf8'));
const sets = JSON.parse(await readFile(P('data/sets.json'), 'utf8'));
const wish = JSON.parse(await readFile(P('data/wishlist.json'), 'utf8'));

process.stderr.write('fetching PokéSprite dex data...\n');
const dexRes = await fetch(DEX_URL, { headers: { 'user-agent': UA } });
if (!dexRes.ok) throw new Error(`dex fetch failed: ${dexRes.status}`);
const dex = await dexRes.json();

/* name -> { idx, slug } */
const byName = new Map();
for (const [idx, e] of Object.entries(dex)) {
  const n = e?.name?.eng;
  const slug = e?.slug?.eng;
  if (n && slug) byName.set(n.toLowerCase(), { idx, slug });
}

/* Strip TCG decoration to recover the species name. */
function species(raw) {
  let s = String(raw).toLowerCase();
  s = s.replace(/\s*\([^)]*\)\s*/g, ' ');
  s = s.replace(/\s*\b(ex|gx|v|vmax|vstar|δ)\b\s*/g, ' ');
  s = s.replace(/^m\s+/, '').replace(/^mega\s+/, '');
  s = s.replace(/^[a-z]'s\s+/, '');          // N's Reshiram
  s = s.replace(/-/g, ' ');
  s = s.replace(/\s*\d.*$/, '');
  s = s.replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}
function resolve(raw) {
  const s = species(raw);
  if (byName.has(s)) return byName.get(s);
  const first = s.split(' ')[0];
  if (byName.has(first)) return byName.get(first);
  return null;
}

/* Every name that appears anywhere in the site. */
const names = new Set();
for (const c of cards) names.add(c.name);
for (const s of sets) for (const sl of s.slots) names.add(sl.name);
for (const w of wish) if (!w.owned) names.add(w.name);

const map = {};
const unmapped = [];
const needSlugs = new Map();
for (const n of names) {
  const hit = resolve(n);
  if (!hit) { unmapped.push(n); continue; }
  map[n] = `${hit.slug}.png`;
  needSlugs.set(hit.slug, hit.idx);
}

console.log(`\ndistinct names: ${names.size}`);
console.log(`mapped:         ${Object.keys(map).length} (${((Object.keys(map).length / names.size) * 100).toFixed(1)}%)`);
console.log(`distinct sprites needed: ${needSlugs.size}`);
if (unmapped.length) {
  console.log(`\nunmapped (${unmapped.length}) - these fall back to no sprite:`);
  for (const u of unmapped.sort()) console.log(`   ${u}`);
}

if (!WRITE) { console.log('\nDry run - nothing downloaded. Re-run with --write.'); process.exit(0); }

await mkdir(OUT, { recursive: true });
let got = 0, skipped = 0, failed = [];
for (const [slug] of needSlugs) {
  const dest = path.join(OUT, `${slug}.png`);
  if (existsSync(dest)) { skipped++; continue; }
  try {
    const r = await fetch(`${SPRITE_BASE}/${slug}.png`, { headers: { 'user-agent': UA } });
    if (!r.ok) throw new Error(String(r.status));
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 80) throw new Error('too small');
    await writeFile(dest, buf);
    if (++got % 25 === 0) process.stderr.write(`  ${got}/${needSlugs.size}\n`);
  } catch (e) {
    failed.push(`${slug}: ${e.message}`);
  }
  await new Promise((s) => setTimeout(s, 60));
}
// Drop any mapping whose file did not land, so the site never 404s.
for (const [name, file] of Object.entries(map)) {
  if (!existsSync(path.join(OUT, file))) delete map[name];
}
await writeFile(P('data/sprites.json'), JSON.stringify(map, null, 1) + '\n');
console.log(`\n✓ ${got} downloaded, ${skipped} already present, ${failed.length} failed`);
for (const f of failed.slice(0, 15)) console.log(`   ! ${f}`);
console.log(`✓ wrote data/sprites.json (${Object.keys(map).length} names)`);
