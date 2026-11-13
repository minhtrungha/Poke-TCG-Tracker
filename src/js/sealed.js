import { loadAll, priceIndex, usd, usd0, tcgUrl, esc, initChrome, initOffline, dataError, byText } from './data.js';
import { bindDetails, sealedDetail } from './detail.js';

initOffline();
initChrome('sealed.html');
const el = (id) => document.getElementById(id);
let items = [], shownRows = [], cardsTotal = null;
const SORTS = ['value', 'unit', 'qty', 'name'];
const SORT_KEY = 'ptcg-sealed-sort';
const state = { sort: 'value' };

function loadSort() {
  const u = new URLSearchParams(location.search).get('sort');
  let saved = null;
  try { saved = localStorage.getItem(SORT_KEY); } catch (_) {}
  state.sort = SORTS.includes(u) ? u : SORTS.includes(saved) ? saved : 'value';
  // A sort restored from storage is also written to the URL, like the Cards
  // page, so the address always describes what is on screen.
  if (u !== state.sort && state.sort !== 'value') saveSort();
}
function saveSort() {
  try { localStorage.setItem(SORT_KEY, state.sort); } catch (_) {}
  const qs = state.sort === 'value' ? '' : `?sort=${state.sort}`;
  try { history.replaceState(history.state, '', location.pathname + qs + location.hash); } catch (_) {}
}

(async function main() {
  loadSort();
  const d = await loadAll();
  el('err').innerHTML = dataError(d._err);
  items = (d.sealed || []).map((s) => ({
    ...s,
    qty: s.qty || 1,
    line: typeof s.price_usd === 'number' ? s.price_usd * (s.qty || 1) : null,
  }));

  // Card value, priced exactly as the Portfolio does, so the share adds up there too.
  const px = priceIndex(d.prices, d.sets);
  const vals = (d.cards || []).map((c) => px.get(c)).filter((p) => typeof p === 'number');
  cardsTotal = vals.length ? vals.reduce((a, b) => a + b, 0) : null;

  if (!items.length) {
    el('out').innerHTML = `<div class="empty-st"><h3>No sealed product tracked</h3>
      <p>Add entries to <code>data/sealed.json</code> with a name, set and quantity,
      then run <code>npm run prices:write</code> to price them.</p></div>`;
    el('stats').innerHTML = '';
    return;
  }
  bindDetails(el('out'), () => shownRows.map(sealedDetail));
  el('fSort').value = state.sort;
  el('fSort').addEventListener('change', (e) => { state.sort = e.target.value; saveSort(); render(); });
  render();
})();

function render() {
  const rows = items.slice().sort({
    value: (a, b) => (b.line ?? -1) - (a.line ?? -1) || byText(a.name, b.name),
    unit: (a, b) => (b.price_usd ?? -1) - (a.price_usd ?? -1) || byText(a.name, b.name),
    qty: (a, b) => b.qty - a.qty || (b.line ?? -1) - (a.line ?? -1),
    name: (a, b) => byText(a.name, b.name),
  }[state.sort]);

  shownRows = rows;
  const priced = rows.filter((r) => typeof r.line === 'number');
  const total = priced.reduce((s, r) => s + r.line, 0);
  const units = rows.reduce((s, r) => s + r.qty, 0);
  const holdings = cardsTotal == null ? null : cardsTotal + total;
  const share = holdings ? total / holdings : null;

  el('stats').innerHTML = `
    <div class="stat"><div class="stat-k">Sealed value</div><div class="stat-v big">${usd0(total)}</div></div>
    ${share != null ? `<div class="stat sl-share"><div class="stat-k">Share of holdings</div>
      <div class="stat-v">${Math.round(share * 100)}%</div>
      <div class="sl-share-bar" role="img" aria-label="Sealed is ${Math.round(share * 100)}% of ${usd0(holdings)} total holdings">
        <i style="width:${(share * 100).toFixed(1)}%"></i></div>
      <span class="stat-sub">of ${usd0(holdings)} cards + sealed</span></div>` : ''}
    <div class="stat"><div class="stat-k">Products</div><div class="stat-v">${rows.length}<span class="stat-sub">${units} units</span></div></div>
    ${priced.length < rows.length
      ? `<div class="stat"><div class="stat-k">Unpriced</div><div class="stat-v">${rows.length - priced.length}</div></div>` : ''}`;

  const on = (k) => (state.sort === k ? ' on' : '');
  el('head').innerHTML = `<span class="sl-h-name${on('name')}">Product${state.sort === 'qty' ? ' · by quantity' : ''}</span>
    <span class="sl-h-unit${on('unit')}">Each</span><span class="sl-h-line${on('value')}">Line value</span>`;

  const maxLine = Math.max(0, ...priced.map((r) => r.line));
  el('out').innerHTML = rows.map((s, i) => `<div class="sealed-row" data-i="${i}">
      <button type="button" class="card-hit" data-open aria-label="Details for ${esc(s.name)}"></button>
      <div class="sealed-img">${s.image
        ? `<img src="images/sealed/${esc(s.image)}" alt="" loading="lazy" decoding="async">`
        : ''}</div>
      <div class="sealed-qty" title="quantity owned">×${esc(String(s.qty))}</div>
      <div class="sealed-main">
        <div class="sealed-n">${esc(s.name)}</div>
        <div class="sealed-s">${esc(s.set || '')}${s.price_source === 'manual' ? ' · <span class="sl-manual">price entered by hand</span>' : ''}</div>
        ${typeof s.line === 'number' && total ? `<div class="sl-bar" aria-hidden="true"><i style="width:${(s.line / maxLine * 100).toFixed(1)}%"></i></div>
          <div class="sl-pct">${Math.round(s.line / total * 100)}% of sealed</div>` : ''}
      </div>
      <div class="sealed-unit${on('unit')}">${typeof s.price_usd === 'number' ? usd(s.price_usd) + ' ea' : '<span class="muted">no price</span>'}</div>
      <div class="sealed-line${on('value')}">${typeof s.line === 'number' ? usd(s.line) : '—'}</div>
      <a class="btn" href="${s.tcgplayer_id ? `https://www.tcgplayer.com/product/${encodeURIComponent(s.tcgplayer_id)}` : tcgUrl(s.search_string || s.name)}" target="_blank" rel="noopener">TCG</a>
    </div>`).join('');
}
