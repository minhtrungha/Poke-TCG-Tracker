#!/usr/bin/env node
/* Copy src/, data/ and images/ into dist/. No framework, no deps. */
import { cp, rm, mkdir, readdir, stat, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const p = (...a) => path.join(root, ...a);

async function du(dir) {
  let n = 0, b = 0;
  async function walk(d) {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) await walk(f);
      else { n++; b += (await stat(f)).size; }
    }
  }
  if (existsSync(dir)) await walk(dir);
  return { n, b };
}

const die = (m) => { console.error(`\x1b[31m✗ ${m}\x1b[0m`); process.exit(1); };

// Validate the JSON before shipping it.
const data = {};
for (const f of ['cards', 'sets', 'prices', 'wishlist']) {
  const fp = p('data', `${f}.json`);
  if (!existsSync(fp)) die(`data/${f}.json is missing.`);
  try { data[f] = JSON.parse(await readFile(fp, 'utf8')); }
  catch (e) { die(`data/${f}.json is not valid JSON — ${e.message}`); }
}
const ids = new Set();
for (const c of data.cards) {
  if (c.id == null) die(`A card has no id: ${JSON.stringify(c).slice(0, 80)}`);
  if (ids.has(c.id)) die(`Duplicate card id ${c.id}.`);
  ids.add(c.id);
}
let dangling = 0;
for (const s of data.sets) for (const sl of s.slots || []) {
  if (sl.card_id != null && !ids.has(sl.card_id)) {
    console.warn(`\x1b[33m! set "${s.key}" slot ${sl.number} points at missing card id ${sl.card_id}\x1b[0m`);
    dangling++;
  }
}
let missingImg = 0;
for (const c of data.cards) {
  if (c.image && !existsSync(p('images/cards', c.image))) {
    console.warn(`\x1b[33m! card ${c.id} references images/cards/${c.image}, which is not there\x1b[0m`);
    missingImg++;
  }
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(p('src'), dist, { recursive: true });
await cp(p('data'), path.join(dist, 'data'), { recursive: true });
if (existsSync(p('images'))) await cp(p('images'), path.join(dist, 'images'), { recursive: true });

const { n, b } = await du(dist);
console.log(`\x1b[32m✓ built dist/\x1b[0m — ${n} files, ${(b / 1e6).toFixed(1)} MB`);
console.log(`  ${data.cards.length} cards · ${data.sets.length} sets · ${data.wishlist.length} wishlist entries`);
console.log(`  prices last checked: ${data.prices.checked_date ?? 'never'}`);
if (dangling || missingImg) console.log(`  ${dangling} dangling slot ref(s), ${missingImg} missing image(s)`);
