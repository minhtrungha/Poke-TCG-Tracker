#!/usr/bin/env node
/* Fetch real TCGplayer market prices from TCGCSV (a free daily mirror, no API
   key) and write them into data/prices.json, keyed by set_key as the site
   expects.

   Usage:
     node scripts/fetch-prices.mjs            # dry run: report, write nothing
     node scripts/fetch-prices.mjs --write    # write data/prices.json

   TCGCSV mirrors TCGplayer's own price feed once a day. We read `marketPrice`
   (the median of recent sales), never `lowPrice`, per the update-prices skill.
*/
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const P = (...a) => path.join(ROOT, ...a);
const BASE = 'https://tcgcsv.com/tcgplayer';
const CAT = { EN: 3, JP: 85 };
const WRITE = process.argv.includes('--write');

// Identify this script honestly. TCGCSV asks clients to send a User-Agent;
// this names the tool, not the person running it.
const UA = 'poke-tcg-tracker/1.0 (personal collection price sync)';

const j = async (u, tries = 3) => {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(u, {
        headers: { accept: 'application/json', 'user-agent': UA },
      });
      if (!r.ok) throw new Error(`${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === tries) throw new Error(`${e.message} ${u}`);
      await new Promise((s) => setTimeout(s, 400 * i));
    }
  }
};
const rows = (o) => o.results ?? o;

/* --- normalisation -------------------------------------------------- */
const normNum = (s) => String(s ?? '').trim().toUpperCase()
  .replace(/\s+/g, ' ')
  .replace(/^([A-Z]{2,4})\s*0*(\d+)$/, '$1 $2');

const numKey = (s) => {
  const n = normNum(s);
  const m = n.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return `${String(+m[1])}/${String(+m[2])}`;
  const p = n.match(/^([A-Z]{2,4})\s*(\d+)$/);
  if (p) return `${p[1]} ${+p[2]}`;
  // bare digits, possibly zero-padded ("037" -> "37")
  if (/^\d+$/.test(n)) return String(+n);
  return n;
};

const prodNum = (p) => {
  for (const e of p.extendedData ?? []) if (e.name === 'Number') return e.value;
  const m = String(p.name).match(/-\s*([A-Z]*\s*[\d/]+)\s*$/i);
  return m ? m[1] : '';
};

const baseName = (s) => String(s).split(' - ')[0]
  // TCGplayer qualifies variants in parentheses: "(Secret)", "(100 Full Art)",
  // "(Cosmos Holo)". Those are printing details, not part of the card name.
  .replace(/\s*\([^)]*\)\s*/g, ' ')
  // "M Gallade-EX" vs "M Gallade EX"; "Leafeon-GX" vs "Leafeon GX"
  .replace(/-/g, ' ')
  .replace(/\s+/g, ' ').trim().toLowerCase();

/* --- load local data -------------------------------------------------- */
const cards = JSON.parse(await readFile(P('data/cards.json'), 'utf8'));
const sets = JSON.parse(await readFile(P('data/sets.json'), 'utf8'));
const prices = JSON.parse(await readFile(P('data/prices.json'), 'utf8'));
let sealed = [];
try { sealed = JSON.parse(await readFile(P('data/sealed.json'), 'utf8')); } catch {}

/* --- build the catalogue, indexed by card number --------------------- */
const catalogue = {};
const allProducts = [];
for (const [lang, cat] of Object.entries(CAT)) {
  process.stderr.write(`loading ${lang} catalogue...\n`);
  const groups = rows(await j(`${BASE}/${cat}/groups`));
  const byNum = new Map();
  let done = 0;
  for (const g of groups) {
    let prods, pr;
    try {
      [prods, pr] = await Promise.all([
        j(`${BASE}/${cat}/${g.groupId}/products`),
        j(`${BASE}/${cat}/${g.groupId}/prices`),
      ]);
    } catch { continue; }
    const price = new Map();
    for (const r of rows(pr)) {
      if (typeof r.marketPrice !== 'number') continue;
      const cur = price.get(r.productId);
      if (!cur) price.set(r.productId, r);
    }
    for (const p of rows(prods)) {
      const r = price.get(p.productId);
      if (!r) continue;
      const k = numKey(prodNum(p));
      if (!k) continue;
      if (!byNum.has(k)) byNum.set(k, []);
      byNum.get(k).push({
        name: p.name,
        base: baseName(p.name),
        group: g.name,
        market: r.marketPrice,
        sub: r.subTypeName,
        stamped: /stamp/i.test(p.name),
      });
    }
    // Sealed products carry no card number, so index them by name instead.
    for (const p of rows(prods)) {
      const r = price.get(p.productId);
      if (!r) continue;
      allProducts.push({ name: p.name, group: g.name, market: r.marketPrice });
    }
    if (++done % 50 === 0) process.stderr.write(`  ${done}/${groups.length} groups\n`);
  }
  catalogue[lang] = byNum;
  process.stderr.write(`  ${lang}: ${byNum.size} distinct card numbers\n`);
}

/* --- match each owned card -------------------------------------------- */
const nameKey = new Map(sets.map((s) => [s.name, s.key]));
const out = {};
const hits = [];
const misses = [];
const ambiguous = [];

/* A card outside every tracked set still needs a bucket of its own, keyed by
   its set, so two different printings of one number never share a price. */
const setBucket = (c) => 'set-' + String(c.set).toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

for (const c of cards) {
  const idx = catalogue[c.lang === 'JP' ? 'JP' : 'EN'];
  // Candidate keys, most specific first. Promos are filed under bare digits
  // ("MEP 037" -> "37"), and older sets drop the set total ("35/108" -> "35").
  const keys = [numKey(c.number)];
  const pfx = normNum(c.number).match(/^([A-Z]{2,4})\s*(\d+)$/);
  if (pfx) keys.push(String(+pfx[2]));
  const frac = normNum(c.number).match(/^(\d+)\s*\/\s*\d+$/);
  if (frac) keys.push(String(+frac[1]));
  let cands = [];
  for (const k of keys) {
    const got = idx.get(k);
    if (got && got.length) { cands = got; break; }
  }
  const want = baseName(c.name);
  const wantStamp = /stamp/i.test(c.set) || /stamp/i.test(c.printing || '');
  let pick = cands.filter((x) => x.base === want);
  if (pick.length > 1) {
    const s = pick.filter((x) => x.stamped === wantStamp);
    if (s.length) pick = s;
  }
  // baseName() strips parenthetical variants, so "Pikachu - 027" and
  // "Pikachu - 027 (Pokemon Center Exclusive)" collapse to the same name while
  // being different cards at very different prices. Unless the local record
  // names that variant, prefer the plain printing.
  if (pick.length > 1) {
    const localHas = (v) => new RegExp(v, 'i').test(`${c.name} ${c.set} ${c.printing || ''}`);
    const plain = pick.filter((x) => {
      const paren = String(x.name).match(/\(([^)]+)\)/g) || [];
      return paren.every((p) => localHas(p.replace(/[()]/g, '').split(/\s+/)[0]));
    });
    if (plain.length) pick = plain;
  }
  if (!pick.length) { misses.push(c); continue; }
  // A bare-number fallback can collide across sets, so when several products
  // share a name+number, prefer one whose TCGplayer group plausibly matches
  // the set recorded locally. Distinctive words only - "pokemon", "ex" etc.
  // are too common to discriminate.
  if (pick.length > 1) {
    const STOP = new Set(['the', 'and', 'ex', 'gx', 'pokemon', 'pokémon', 'card',
      'black', 'star', 'promos', 'promo', 'collection', 'set', 'sv', 'tcg']);
    const words = String(c.set).toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
    const scored = pick.map((x) => {
      const g = x.group.toLowerCase();
      return { x, n: words.filter((w) => g.includes(w)).length };
    });
    const best = Math.max(...scored.map((s) => s.n));
    if (best > 0) pick = scored.filter((s) => s.n === best).map((s) => s.x);
  }
  // Still ambiguous: these are different cards that merely share a number, so
  // a median across them is a fabricated price. Report it instead of guessing.
  if (pick.length > 1) {
    const groups = new Set(pick.map((x) => x.group));
    if (groups.size > 1) { ambiguous.push({ c, pick: [...pick] }); continue; }
  }
  pick.sort((a, b) => a.market - b.market);
  const chosen = pick[Math.floor((pick.length - 1) / 2)];
  // Bucket key: the card's tracked set when it has one, otherwise a stable
  // per-set bucket so the site can still resolve it. Store the number EXACTLY
  // as cards.json records it - the site matches on that string.
  const key = c.set_key || nameKey.get(c.set) || setBucket(c);
  if (!out[key]) out[key] = {};
  out[key][c.number] = Math.round(chosen.market * 100) / 100;
  hits.push({ c, chosen, key });
}

/* --- cards the owner does NOT own yet --------------------------------- */
/* Empty set slots and standalone wants, so the Wishlist can total real costs.
   Same matcher as above; ambiguous ones are simply left unpriced. */
const wish = JSON.parse(await readFile(P('data/wishlist.json'), 'utf8'));
const wants = [];
for (const s of sets) {
  for (const sl of s.slots) {
    if (sl.card_id != null) continue;
    wants.push({ key: s.key, number: sl.number, name: sl.name, lang: s.lang || 'EN', set: s.name });
  }
}
for (const w of wish) {
  if (w.owned) continue;
  wants.push({ key: nameKey.get(w.set) || setBucket(w), number: w.number, name: w.name,
               lang: w.lang || 'EN', set: w.set, wishEntry: w });
}
let wantHits = 0;
for (const w of wants) {
  const idx = catalogue[w.lang === 'JP' ? 'JP' : 'EN'];
  const keys = [numKey(w.number)];
  const pfx = normNum(w.number).match(/^([A-Z]{2,4})\s*(\d+)$/); if (pfx) keys.push(String(+pfx[2]));
  const frac = normNum(w.number).match(/^(\d+)\s*\/\s*\d+$/); if (frac) keys.push(String(+frac[1]));
  let cands = [];
  for (const k of keys) { const g = idx.get(k); if (g && g.length) { cands = g; break; } }
  if (/^\d+$/.test(normNum(w.number))) {
    const n = String(+normNum(w.number));
    for (const [k, v] of idx) if (k.startsWith(`${n}/`)) cands = cands.concat(v);
  }
  let pick = cands.filter((x) => x.base === baseName(w.name));
  if (!pick.length) {
    const bare = baseName(String(w.name).replace(/\s*\d+\s*\/\s*\d+\s*$/, ''));
    pick = cands.filter((x) => x.base === bare);
  }
  if (!pick.length) continue;
  if (pick.length > 1) {
    const STOP2 = new Set(['the', 'and', 'ex', 'gx', 'pokemon', 'pokémon', 'card',
      'black', 'star', 'promos', 'promo', 'collection', 'set', 'sv', 'tcg']);
    const words = String(w.set).toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/).filter((x) => x.length > 3 && !STOP2.has(x));
    const scored = pick.map((x) => ({ x, n: words.filter((v) => x.group.toLowerCase().includes(v)).length }));
    const best = Math.max(...scored.map((v) => v.n));
    if (best > 0) pick = scored.filter((v) => v.n === best).map((v) => v.x);
    else if (new Set(pick.map((x) => x.group)).size > 1) continue;  // too ambiguous
  }
  pick.sort((a, b) => a.market - b.market);
  const price = Math.round(pick[Math.floor((pick.length - 1) / 2)].market * 100) / 100;
  if (!out[w.key]) out[w.key] = {};
  if (out[w.key][w.number] === undefined) out[w.key][w.number] = price;
  if (w.wishEntry) { w.wishEntry.price_usd = price; w.wishEntry.price_checked = null; }
  wantHits++;
}
console.log(`\nwanted cards priced: ${wantHits}/${wants.length}`);

/* --- sealed products -------------------------------------------------- */
const norm = (s) => String(s).toLowerCase()
  .replace(/[‘’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ')
  .replace(/\s+/g, ' ').trim();
const sealedHits = [];
const sealedMiss = [];
for (const s of sealed) {
  const want = norm(s.search_string || s.name);
  let exact = allProducts.filter((p) => norm(p.name) === want);
  if (!exact.length) {
    // allow a bracketed variant to be dropped: "ETB [Mega Lucario]"
    const loose = want.replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+/g, ' ').trim();
    exact = allProducts.filter((p) => norm(p.name) === loose);
  }
  if (!exact.length) { sealedMiss.push(s); continue; }
  exact.sort((a, b) => a.market - b.market);
  const chosen = exact[Math.floor((exact.length - 1) / 2)];
  sealedHits.push({ s, chosen });
}
const sealedTotal = sealedHits.reduce((t, h) => t + h.chosen.market * (h.s.qty || 1), 0);
if (sealed.length) {
  console.log(`\nsealed: matched ${sealedHits.length}/${sealed.length} · value $${sealedTotal.toFixed(2)}`);
  for (const h of sealedHits) {
    console.log(`  $${String(h.chosen.market).padStart(8)} x${h.s.qty || 1}  ${h.s.name}`);
  }
  for (const m of sealedMiss) console.log(`  (no match) ${m.name}`);
}

/* --- report ----------------------------------------------------------- */
const total = hits.reduce((s, h) => s + h.chosen.market, 0);
console.log(`\nmatched ${hits.length}/${cards.length} cards · unmatched ${misses.length}`);
console.log(`collection value: $${total.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
console.log('\ntop 12 by market price:');
for (const h of [...hits].sort((a, b) => b.chosen.market - a.chosen.market).slice(0, 12)) {
  console.log(`  $${String(h.chosen.market).padStart(9)}  ${h.c.name} ${h.c.number} [${h.c.lang}] - ${h.chosen.group}`);
}
if (ambiguous.length) {
  console.log(`\nAMBIGUOUS - left unpriced (${ambiguous.length}):`);
  for (const a of ambiguous) {
    console.log(`  ${a.c.name} ${a.c.number} [${a.c.lang}] - ${a.c.set}`);
    for (const p of a.pick) console.log(`      $${p.market}  ${p.group} / ${p.name}`);
  }
}
if (misses.length) {
  console.log(`\nno match (${misses.length}):`);
  for (const m of misses.slice(0, 40)) console.log(`  ${m.name} ${m.number} [${m.lang}] - ${m.set}`);
  if (misses.length > 40) console.log(`  ...and ${misses.length - 40} more`);
}

if (!WRITE) {
  console.log('\nDry run - nothing written. Re-run with --write.');
  process.exit(0);
}

/* --- write ------------------------------------------------------------ */
const today = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
const keep = new Set(['checked_date', 'sources', 'history']);
const next = {};
for (const [k, v] of Object.entries(prices)) {
  if (k.startsWith('_') || keep.has(k)) next[k] = v;
}
Object.assign(next, out);
next.checked_date = today;
next.sources = Object.fromEntries(
  Object.keys(out).map((k) => [k, 'TCGplayer market price via tcgcsv.com']));
const hist = (prices.history || []).filter((h) => h.date !== today);
hist.push({
  date: today,
  total: Math.round((total + sealedTotal) * 100) / 100,
  cards: hits.length,
  cards_total: Math.round(total * 100) / 100,
  sealed_total: Math.round(sealedTotal * 100) / 100,
});
hist.sort((a, b) => new Date(a.date) - new Date(b.date));
next.history = hist;
next.sealed_total = Math.round(sealedTotal * 100) / 100;
await writeFile(P('data/prices.json'), JSON.stringify(next, null, 1) + '\n');
console.log(`\n✓ wrote data/prices.json - ${hits.length} prices, checked ${today}`);

if (sealedHits.length) {
  const byId = new Map(sealedHits.map((h) => [h.s.id, h.chosen]));
  for (const s of sealed) {
    const c = byId.get(s.id);
    if (c) { s.price_usd = Math.round(c.market * 100) / 100; s.price_checked = today; }
  }
  await writeFile(P('data/sealed.json'), JSON.stringify(sealed, null, 1) + '\n');
  console.log(`✓ wrote data/sealed.json - ${sealedHits.length} sealed price(s)`);
}

const wishPriced = wish.filter((w) => typeof w.price_usd === 'number').length;
if (wishPriced) {
  for (const w of wish) if (typeof w.price_usd === 'number') w.price_checked = today;
  await writeFile(P('data/wishlist.json'), JSON.stringify(wish, null, 1) + '\n');
  console.log(`✓ wrote data/wishlist.json - ${wishPriced} want price(s)`);
}

// Give every priced card an explicit set_key pointing at its bucket, so the
// site resolves it directly instead of guessing from the set name.
const keyFor = new Map(hits.map((h) => [h.c.id, h.key]));
let tagged = 0;
for (const c of cards) {
  const k = keyFor.get(c.id);
  if (k && c.set_key !== k) { c.set_key = k; tagged++; }
}
if (tagged) {
  await writeFile(P('data/cards.json'), JSON.stringify(cards, null, 1) + '\n');
  console.log(`✓ set_key filled in for ${tagged} card(s) in data/cards.json`);
}
