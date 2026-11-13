import { loadAll, priceIndex, usd, usd0, daysSince, tcgUrl, pcUrl, imgTag, esc,
         langBadge, initChrome, initOffline, dataError, sprite, normNum } from './data.js';
import { valueChart, bindChart } from './chart.js';
import { bindDetails, ownedDetail } from './detail.js';

initOffline();
initChrome('index.html');

const el = (id) => document.getElementById(id);
const state = { sort: 'price', set: 'all', lang: 'all' };
let priced = [], sealedTotal = 0, sealedUnits = 0, sealedCount = 0;
let shownRows = [], movers = [], ctx = {};

/* card -> detail object, carrying the change since the previous sync when known */
const detailOf = (c) => {
  const o = ownedDetail(c, { price: c.price, ...ctx });
  if (c.chg) o.priceChange = c.chg;
  return o;
};

(async function main() {
  const d = await loadAll();
  el('err').innerHTML = dataError(d._err);
  const px = priceIndex(d.prices, d.sets);
  ctx = { checked: d.prices && d.prices.checked_date, sprites: d.sprites || {} };
  bindDetails(el('out'), () => shownRows.map(detailOf));
  bindDetails(el('movers'), () => movers.map(detailOf));
  for (const x of d.sealed || []) {
    sealedCount++;
    sealedUnits += x.qty || 1;
    if (typeof x.price_usd === 'number') sealedTotal += x.price_usd * (x.qty || 1);
  }

  // Previous sync's per-card prices (prices.json `_prev`), same bucket rules
  // as priceIndex: a card only compares against its own set bucket.
  const prev = (d.prices && d.prices._prev) || null;
  const prevAt = (c) => {
    if (!prev) return null;
    const key = c.set_key || px.nameToKey.get(c.set);
    const b = key && prev[key];
    if (!b || typeof b !== 'object') return null;
    const n = normNum(c.number);
    for (const [num, v] of Object.entries(b)) if (normNum(num) === n && typeof v === 'number') return v;
    return null;
  };

  // Portfolio shows ONLY cards that have a price (per the brief).
  priced = d.cards
    .map((c) => ({ ...c, price: px.get(c) }))
    .filter((c) => typeof c.price === 'number')
    .map((c) => {
      const was = prevAt(c);
      if (was == null) return c;
      const delta = Math.round((c.price - was) * 100) / 100;
      return { ...c, chg: { delta, pct: was ? (delta / was) * 100 : 0, since: prev.date, was } };
    });

  const cardsTotal = priced.reduce((s, c) => s + c.price, 0);
  renderHero(d.prices, d.cards.length, cardsTotal);
  el('chart').innerHTML = valueChart(d.prices && d.prices.history);
  bindChart(el('chart'));

  if (px.isEmpty || !priced.length) {
    el('stats').innerHTML = '';
    el('bar').style.display = 'none';
    el('out').innerHTML = `<div class="empty-st">
      <h3>No prices recorded yet</h3>
      <p>This page ranks your cards by market value, and stays empty until
      <code>data/prices.json</code> has numbers in it. Say <strong>“update prices”</strong>
      in Claude Code to fetch current TCGplayer and PriceCharting values for your
      ${d.cards.length} cards — nothing here is auto-fetched.</p></div>`;
    return;
  }

  renderMovers(prev);

  // filter options
  const sets = [...new Set(priced.map((c) => c.set))].sort();
  el('fSet').innerHTML = `<option value="all">All sets</option>` +
    sets.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');

  el('fSort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  el('fSet').addEventListener('change', (e) => { state.set = e.target.value; render(); });
  el('fLang').addEventListener('change', (e) => { state.lang = e.target.value; render(); });
  render();
})();

/* The headline: total holdings, change since the previous sync, the split
   between cards and sealed, and when prices were last checked (this replaces
   the old separate banner, including its stale-price warning). */
function renderHero(prices, cardCount, cardsTotal) {
  const hero = el('hero');
  const cd = prices && prices.checked_date;
  if (!cd) {
    hero.className = 'hero empty';
    hero.innerHTML = `<div class="hero-k">Total holdings</div>
      <div class="hero-v">—</div>
      <p class="hero-meta">Prices have never been updated · say “update prices” in Claude Code · ${cardCount} cards tracked</p>`;
    return;
  }
  const age = daysSince(cd);
  const stale = age != null && age > 30;
  const veryStale = age != null && age > 90;
  const total = cardsTotal + sealedTotal;

  const hist = (prices.history || []).slice()
    .filter((h) => typeof h.total === 'number' && !isNaN(new Date(h.date)))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  let chg = '';
  if (hist.length >= 2) {
    const a = hist[hist.length - 2], b = hist[hist.length - 1];
    const dlt = b.total - a.total, pct = a.total ? (dlt / a.total) * 100 : 0;
    const dir = Math.abs(dlt) < 0.005 ? 'flat' : dlt > 0 ? 'up' : 'down';
    chg = `<span class="hero-chg ${dir}">
        <span aria-hidden="true">${dir === 'up' ? '▲' : dir === 'down' ? '▼' : '•'}</span>
        <span class="sr">${dir === 'up' ? 'Up' : dir === 'down' ? 'Down' : 'No change'}</span>
        ${usd(Math.abs(dlt))} <span class="hero-pct">(${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%)</span>
      </span><span class="hero-since">since ${esc(a.date)}</span>`;
    // Split it, so a jump from adding sealed product isn't read as the market moving.
    const part = (k, lab) => {
      if (typeof a[k] !== 'number' || typeof b[k] !== 'number') return '';
      const d = b[k] - a[k];
      const dd = Math.abs(d) < 0.005 ? 'flat' : d > 0 ? 'up' : 'down';
      return `<span class="hero-part ${dd}">${lab} ${dd === 'up' ? '▲' : dd === 'down' ? '▼' : '•'} ${usd(Math.abs(d))}</span>`;
    };
    const parts = part('cards_total', 'Cards') + part('sealed_total', 'Sealed');
    if (parts) chg += `<span class="hero-parts" title="Includes value from holdings added or changed between syncs, not only price moves">${parts}</span>`;
  }

  const share = total ? Math.round((cardsTotal / total) * 100) : 100;
  hero.className = 'hero' + (stale ? (veryStale ? ' stale very' : ' stale') : '');
  hero.innerHTML = `
    <div class="hero-main">
      <div class="hero-k">Total holdings</div>
      <div class="hero-v">${usd(total)}</div>
      <div class="hero-row">${chg}</div>
    </div>
    <div class="hero-side">
      <div class="hero-split" role="img" aria-label="Cards ${share}%, sealed ${100 - share}% of total">
        <i class="cards" style="width:${share}%"></i><i class="sealed" style="width:${100 - share}%"></i>
      </div>
      <dl class="hero-parts">
        <div><dt><span class="sw cards" aria-hidden="true"></span>Cards</dt>
          <dd>${usd0(cardsTotal)} <small>${priced.length} priced · ${share}%</small></dd></div>
        <div><dt><span class="sw sealed" aria-hidden="true"></span><a href="sealed.html">Sealed →</a></dt>
          <dd>${usd0(sealedTotal)} <small>${sealedUnits} units · ${100 - share}%</small></dd></div>
      </dl>
    </div>
    <p class="hero-meta">${stale
      ? `<strong>⚠ Prices may be out of date</strong> — last checked ${esc(cd)}, ${age} days ago. Say “update prices” to refresh.`
      : `Prices updated ${esc(cd)} · TCGplayer market estimates, not an appraisal`}</p>`;
}

/* Biggest movers since the previous sync: top gainers and losers by $ change. */
function renderMovers(prev) {
  const box = el('movers');
  const changed = priced.filter((c) => c.chg && Math.abs(c.chg.delta) >= 0.01);
  if (!prev || !changed.length) { box.hidden = true; movers = []; return; }
  const gain = changed.filter((c) => c.chg.delta > 0).sort((a, b) => b.chg.delta - a.chg.delta).slice(0, 5);
  const lose = changed.filter((c) => c.chg.delta < 0).sort((a, b) => a.chg.delta - b.chg.delta).slice(0, 5);
  movers = [...gain, ...lose];
  const row = (c, i) => {
    const up = c.chg.delta > 0;
    return `<li class="mv" data-i="${i}">
      <button type="button" class="card-hit" data-open aria-label="Details for ${esc(c.name)} ${esc(c.number)}"></button>
      <span class="mv-img">${imgTag(c, { thumb: true })}</span>
      <span class="mv-main">
        <span class="mv-n">${esc(c.name)} ${langBadge(c.lang)}${sprite(ctx.sprites, c.name, 'name-sprite')}</span>
        <span class="mv-s">${esc(c.number)} · ${esc(c.set)}</span>
      </span>
      <span class="mv-p">
        <span class="mv-now">${usd(c.price)}</span>
        <span class="mv-d ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${usd(Math.abs(c.chg.delta))}
          <small>${up ? '+' : '−'}${Math.abs(c.chg.pct).toFixed(1)}%</small></span>
      </span></li>`;
  };
  const col = (title, list, off, cls) => `<div class="mv-col ${cls}">
      <h3 class="mv-h">${title}</h3>
      ${list.length ? `<ol class="mv-list">${list.map((c, k) => row(c, off + k)).join('')}</ol>`
        : `<p class="mv-none">Nothing ${cls === 'up' ? 'went up' : 'went down'}.</p>`}</div>`;
  box.hidden = false;
  box.innerHTML = `<div class="sec-h">Biggest movers since ${esc(prev.date)}</div>
    <p class="mv-sub">${changed.length} of ${priced.length} cards changed price between syncs.</p>
    <div class="mv-grid">${col('Gainers', gain, 0, 'up')}${col('Losers', lose, gain.length, 'down')}</div>`;
}

function render() {
  let rows = priced.filter((c) =>
    (state.set === 'all' || c.set === state.set) &&
    (state.lang === 'all' || (c.lang || 'EN') === state.lang));

  const cmp = {
    price: (a, b) => b.price - a.price,
    priceAsc: (a, b) => a.price - b.price,
    set: (a, b) => String(a.set).localeCompare(b.set) || b.price - a.price,
    lang: (a, b) => String(a.lang).localeCompare(b.lang) || b.price - a.price,
  }[state.sort];
  rows.sort(cmp);

  const tot = rows.reduce((s, c) => s + c.price, 0);
  const all = priced.reduce((s, c) => s + c.price, 0);
  const top = priced.reduce((m, c) => (c.price > m.price ? c : m), priced[0]);
  // Totals live in the hero; these tiles add the context it doesn't show.
  el('stats').innerHTML = `
    <div class="stat"><div class="stat-k">Cards priced</div><div class="stat-v">${priced.length}<span class="stat-sub">avg ${usd(all / priced.length)} each</span></div></div>
    <div class="stat"><div class="stat-k">Top card</div><div class="stat-v">${usd0(top.price)}<span class="stat-sub">${esc(top.name)}</span></div></div>
    ${sealedCount ? `<div class="stat"><div class="stat-k"><a href="sealed.html" class="stat-link">Sealed →</a></div><div class="stat-v">${sealedUnits}<span class="stat-sub">units · ${sealedCount} products</span></div></div>` : ''}
    ${rows.length !== priced.length ? `<div class="stat"><div class="stat-k">Shown</div><div class="stat-v">${usd0(tot)}<span class="stat-sub">${rows.length} cards</span></div></div>` : ''}`;

  shownRows = rows;
  el('count').textContent = `${rows.length} card${rows.length === 1 ? '' : 's'}`;
  el('out').innerHTML = rows.map((c, i) => {
    const rank = state.sort === 'price' ? `<span class="rank">#${i + 1}</span>` : '';
    return `<article class="card" data-i="${i}"><button type="button" class="card-hit" data-open aria-label="Details for ${esc(c.name)} ${esc(c.number)}"></button>
      <div class="pocket">${imgTag(c)}${rank}</div>
      <div class="card-b">
        <div class="card-n">${esc(c.name)} ${langBadge(c.lang)}${sprite(ctx.sprites, c.name, 'name-sprite')}</div>
        <div class="card-m">${esc(c.number)}</div>
        <div class="card-s">${esc(c.set)}</div>
        <div class="card-p">${usd(c.price)}</div>
        <div class="card-lnks">
          <a href="${tcgUrl(c.search_string || c.name)}" target="_blank" rel="noopener">TCGplayer</a>
          <a href="${pcUrl(c.name, c.number)}" target="_blank" rel="noopener">PriceCharting</a>
        </div>
      </div></article>`;
  }).join('');
}
