import { loadAll, priceIndex, usd, usd0, daysSince, tcgUrl, pcUrl, imgTag, esc,
         langBadge, initChrome, dataError } from './data.js';
import { valueChart } from './chart.js';

initChrome('index.html');

const el = (id) => document.getElementById(id);
const state = { sort: 'price', set: 'all', lang: 'all' };
let priced = [];

(async function main() {
  const d = await loadAll();
  el('err').innerHTML = dataError(d._err);
  const px = priceIndex(d.prices, d.sets);

  // Portfolio shows ONLY cards that have a price (per the brief).
  priced = d.cards
    .map((c) => ({ ...c, price: px.get(c) }))
    .filter((c) => typeof c.price === 'number');

  renderBanner(d.prices, d.cards.length);
  el('chart').innerHTML = valueChart(d.prices && d.prices.history);

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

  // filter options
  const sets = [...new Set(priced.map((c) => c.set))].sort();
  el('fSet').innerHTML = `<option value="all">All sets</option>` +
    sets.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');

  el('fSort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  el('fSet').addEventListener('change', (e) => { state.set = e.target.value; render(); });
  el('fLang').addEventListener('change', (e) => { state.lang = e.target.value; render(); });
  render();
})();

function renderBanner(prices, total) {
  const cd = prices && prices.checked_date;
  const age = daysSince(cd);
  if (!cd) {
    el('banner').className = 'banner empty';
    el('banner').innerHTML = `<span class="banner-lab">Prices have never been updated</span>
      <span class="banner-note">Say “update prices” in Claude Code · ${total} cards tracked</span>`;
    return;
  }
  const stale = age != null && age > 30;
  el('banner').className = 'banner' + (stale ? ' stale' : '');
  el('banner').innerHTML =
    `<span class="banner-lab">${stale ? '⚠ Prices may be out of date' : 'Prices last updated ' + esc(cd)}</span>` +
    `<span class="banner-note">${stale ? `Last checked ${esc(cd)} — ${age} days ago · ` : ''}Values are estimates only</span>`;
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
  el('stats').innerHTML = `
    <div class="stat"><div class="stat-k">Collection value</div><div class="stat-v big">${usd0(all)}</div></div>
    <div class="stat"><div class="stat-k">Cards priced</div><div class="stat-v">${priced.length}</div></div>
    <div class="stat"><div class="stat-k">Top card</div><div class="stat-v">${usd0(Math.max(...priced.map(c=>c.price)))}</div></div>
    ${rows.length !== priced.length ? `<div class="stat"><div class="stat-k">Shown</div><div class="stat-v">${usd0(tot)}</div></div>` : ''}`;

  el('count').textContent = `${rows.length} card${rows.length === 1 ? '' : 's'}`;
  el('out').innerHTML = rows.map((c, i) => {
    const rank = state.sort === 'price' ? `<span class="rank">#${i + 1}</span>` : '';
    return `<article class="card">
      <div class="pocket">${imgTag(c)}${rank}</div>
      <div class="card-b">
        <div class="card-n">${esc(c.name)} ${langBadge(c.lang)}</div>
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
