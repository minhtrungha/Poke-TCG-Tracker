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

/* sealed products */
let sealed = [];
try { sealed = JSON.parse(await readFile(P('data/sealed.json'), 'utf8')); } catch {}
let sealedTotal = 0, sealedUnpriced = 0;
for (const s of sealed) {
  if (typeof s.price_usd === 'number') sealedTotal += s.price_usd * (s.qty || 1);
  else sealedUnpriced++;
}
if (sealed.length) {
  ok(`sealed: ${sealed.length} product(s), $${sealedTotal.toFixed(2)}`
    + (sealedUnpriced ? ` (${sealedUnpriced} unpriced)` : ''));
}

/* the latest history total should match cards + sealed */
if (hist.length) {
  const last = hist[hist.length - 1];
  const expect = total + sealedTotal;
  if (last.date === prices.checked_date && Math.abs(last.total - expect) > 0.05) {
    bad(`history total $${last.total} != computed $${expect.toFixed(2)} (cards $${total.toFixed(2)} + sealed $${sealedTotal.toFixed(2)})`);
  } else if (last.date === prices.checked_date) {
    ok(`history total matches cards + sealed ($${expect.toFixed(2)})`);
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

/* _prev: the previous sync's per-card prices, used for "biggest movers" */
if (prices._prev) {
  const pv = prices._prev;
  const pd = new Date(pv.date), cd = new Date(prices.checked_date);
  if (!pv.date || isNaN(pd)) bad('_prev has no valid date');
  else if (!(pd < cd)) bad(`_prev date ${pv.date} is not before checked_date ${prices.checked_date}`);
  let n = 0;
  for (const [k, bucket] of Object.entries(pv)) {
    if (k === 'date') continue;
    if (!bucket || typeof bucket !== 'object') { bad(`_prev/${k} is not a bucket`); continue; }
    for (const [num, v] of Object.entries(bucket)) {
      if (typeof v !== 'number' || !(v > 0)) bad(`_prev/${k}/${num} is not a positive number: ${v}`);
      else n++;
    }
  }
  if (pv.date && pd < cd) ok(`_prev: ${n} per-card price(s) from ${pv.date}`);
}

console.log(fail ? `\n${fail} problem(s)` : '\nall checks passed');
process.exit(fail ? 1 : 0);
