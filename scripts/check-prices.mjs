#!/usr/bin/env node
/* Sanity checks on data/prices.json against data/cards.json.

   Run after any price sync: node scripts/check-prices.mjs
   Exits non-zero if something is wrong, so it can gate a deploy.
*/
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const P = (...a) => path.join(ROOT, ...a);

const cards = JSON.parse(await readFile(P('data/cards.json'), 'utf8'));
const sets = JSON.parse(await readFile(P('data/sets.json'), 'utf8'));
const prices = JSON.parse(await readFile(P('data/prices.json'), 'utf8'));
const nameKey = new Map(sets.map((s) => [s.name, s.key]));

let fail = 0;
const bad = (m) => { console.error(`✗ ${m}`); fail++; };
const ok = (m) => console.log(`✓ ${m}`);

/* every card resolves */
const unresolved = [];
let total = 0, priced = 0;
for (const c of cards) {
  const k = c.set_key || nameKey.get(c.set);
  const v = k ? prices[k]?.[c.number] : undefined;
  if (typeof v === 'number') { priced++; total += v; }
  else unresolved.push(c);
}
if (unresolved.length) {
  bad(`${unresolved.length} card(s) have no resolvable price`);
  for (const c of unresolved.slice(0, 10)) console.error(`    ${c.id} ${c.name} ${c.number} (set_key=${c.set_key})`);
} else ok(`all ${priced} cards resolve to a price ($${total.toFixed(2)})`);

/* the stamped/plain split must stay separate */
const dupNums = new Map();
for (const c of cards) {
  const k = `${c.name}|${c.number}`;
  if (!dupNums.has(k)) dupNums.set(k, []);
  dupNums.get(k).push(c);
}
for (const [k, list] of dupNums) {
  if (list.length < 2) continue;
  const keys = new Set(list.map((c) => c.set_key));
  if (keys.size < list.length) {
    bad(`${k} has ${list.length} copies but only ${keys.size} distinct set_key - different printings would share one price`);
  } else ok(`${k}: ${list.length} printings kept in separate buckets`);
}

/* history must be chronological, one entry per date */
const hist = prices.history || [];
const dates = hist.map((h) => h.date);
if (new Set(dates).size !== dates.length) bad('history has duplicate dates');
else if (hist.length) ok(`history: ${hist.length} point(s), latest ${hist[hist.length - 1].date} = $${hist[hist.length - 1].total}`);

/* the latest history total should match the current prices */
if (hist.length) {
  const last = hist[hist.length - 1];
  if (last.date === prices.checked_date && Math.abs(last.total - total) > 0.05) {
    bad(`history total $${last.total} != computed $${total.toFixed(2)} for ${prices.checked_date}`);
  }
}

/* implausible prices are usually a mis-match, not a real value */
for (const [k, bucket] of Object.entries(prices)) {
  if (k.startsWith('_') || ['checked_date', 'sources', 'history'].includes(k)) continue;
  for (const [num, v] of Object.entries(bucket)) {
    if (typeof v !== 'number' || !(v > 0)) bad(`${k}/${num} is not a positive number: ${v}`);
    if (v > 5000) bad(`${k}/${num} = $${v} - implausible, check the match`);
  }
}

console.log(fail ? `\n${fail} problem(s)` : '\nall checks passed');
process.exit(fail ? 1 : 0);
