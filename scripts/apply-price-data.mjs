#!/usr/bin/env node
/* Lay the price data saved on the `prices-data` branch over data/.

   The scheduled price sync (.github/workflows/pages.yml) commits its output to
   the `prices-data` branch instead of main, so main's history never fills up
   with price commits. Every deploy runs this first so the site shows those
   prices.

   Usage:
     node scripts/apply-price-data.mjs <dir>   # <dir> holds the branch's files

   What it merges:
     prices.json   - whichever side has the newer checked_date wins (a tie goes
                     to the branch); history[] is the union of both, so a local
                     `npm run prices:write` committed to main never loses chart
                     points and never gets them overwritten.
     sealed.json   - price fields only, by id, and only for items the sync
                     priced itself. A hand-entered ("manual") price on main is
                     left alone, as fetch-prices does.
     wishlist.json - price_usd / price_checked only, by set + number + name.
     cards.json    - fills in a missing set_key, by id.

   Everything else in those three files - which cards you own, quantities,
   wishlist entries - always comes from main, so collection edits are never
   overwritten by older branch data.
*/
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/apply-price-data.mjs <dir>');
  process.exit(2);
}

const D = (f) => path.join(ROOT, 'data', f);
const B = (f) => path.join(dir, f);
const read = async (fp) => (existsSync(fp) ? JSON.parse(await readFile(fp, 'utf8')) : null);
const write = (fp, v) => writeFile(fp, JSON.stringify(v, null, 1) + '\n');
const when = (p) => {
  const t = Date.parse(p?.checked_date ?? '');
  return Number.isNaN(t) ? -Infinity : t;
};

/* --- prices.json ------------------------------------------------------- */
const local = await read(D('prices.json'));
const branch = await read(B('prices.json'));
if (!branch) {
  console.log('No prices.json in the saved price data - using data/ as committed.');
  process.exit(0);
}

const branchWins = when(branch) >= when(local);
const base = branchWins ? branch : local;
const other = branchWins ? local : branch;
const byDate = new Map();
for (const h of other?.history ?? []) byDate.set(h.date, h);
for (const h of base.history ?? []) byDate.set(h.date, h);
base.history = [...byDate.values()].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
await write(D('prices.json'), base);
console.log(`prices.json: from ${branchWins ? 'the prices-data branch' : 'data/ (newer)'}, `
  + `checked ${base.checked_date}, ${base.history.length} history point(s)`);

// When main's own prices are newer, its other files came from that same local
// sync, so there is nothing older to carry over.
if (!branchWins) process.exit(0);

/* --- sealed.json -------------------------------------------------------- */
const sealed = await read(D('sealed.json'));
const bSealed = await read(B('sealed.json'));
if (sealed && bSealed) {
  const byId = new Map(bSealed.map((s) => [s.id, s]));
  let n = 0;
  for (const s of sealed) {
    const b = byId.get(s.id);
    if (!b || typeof b.price_usd !== 'number' || b.price_source === 'manual') continue;
    if (s.price_usd === b.price_usd && s.price_checked === b.price_checked && !s.price_source) continue;
    s.price_usd = b.price_usd;
    s.price_checked = b.price_checked;
    delete s.price_source;
    delete s.price_note;
    n++;
  }
  if (n) await write(D('sealed.json'), sealed);
  console.log(`sealed.json: ${n} price(s) updated`);
}

/* --- wishlist.json ------------------------------------------------------ */
const wish = await read(D('wishlist.json'));
const bWish = await read(B('wishlist.json'));
if (wish && bWish) {
  const k = (w) => `${w.set}|${w.number}|${w.name}`;
  const byKey = new Map(bWish.map((w) => [k(w), w]));
  let n = 0;
  for (const w of wish) {
    const b = byKey.get(k(w));
    if (!b || typeof b.price_usd !== 'number') continue;
    if (w.price_usd === b.price_usd && w.price_checked === b.price_checked) continue;
    w.price_usd = b.price_usd;
    w.price_checked = b.price_checked;
    n++;
  }
  if (n) await write(D('wishlist.json'), wish);
  console.log(`wishlist.json: ${n} price(s) updated`);
}

/* --- cards.json --------------------------------------------------------- */
const cards = await read(D('cards.json'));
const bCards = await read(B('cards.json'));
if (cards && bCards) {
  const byId = new Map(bCards.map((c) => [c.id, c]));
  let n = 0;
  for (const c of cards) {
    const b = byId.get(c.id);
    if (c.set_key || !b?.set_key) continue;
    c.set_key = b.set_key;
    n++;
  }
  if (n) await write(D('cards.json'), cards);
  console.log(`cards.json: set_key filled in for ${n} card(s)`);
}
