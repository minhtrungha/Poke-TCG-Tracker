import { loadAll, usd, usd0, tcgUrl, esc, initChrome, initOffline, dataError, byText } from './data.js';

initOffline();
initChrome('sealed.html');
const el = (id) => document.getElementById(id);
let items = [];
const state = { sort: 'value' };

(async function main() {
  const d = await loadAll();
  el('err').innerHTML = dataError(d._err);
  items = (d.sealed || []).map((s) => ({
    ...s,
    qty: s.qty || 1,
    line: typeof s.price_usd === 'number' ? s.price_usd * (s.qty || 1) : null,
  }));

  if (!items.length) {
    el('out').innerHTML = `<div class="empty-st"><h3>No sealed product tracked</h3>
      <p>Add entries to <code>data/sealed.json</code> with a name, set and quantity,
      then run <code>npm run prices:write</code> to price them.</p></div>`;
    el('stats').innerHTML = '';
    return;
  }
  el('fSort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  render();
})();

function render() {
  const rows = items.slice().sort({
    value: (a, b) => (b.line ?? -1) - (a.line ?? -1),
    unit: (a, b) => (b.price_usd ?? -1) - (a.price_usd ?? -1),
    qty: (a, b) => b.qty - a.qty,
    name: (a, b) => byText(a.name, b.name),
  }[state.sort]);

  const priced = rows.filter((r) => typeof r.line === 'number');
  const total = priced.reduce((s, r) => s + r.line, 0);
  const units = rows.reduce((s, r) => s + r.qty, 0);

  el('stats').innerHTML = `
    <div class="stat"><div class="stat-k">Sealed value</div><div class="stat-v big">${usd0(total)}</div></div>
    <div class="stat"><div class="stat-k">Products</div><div class="stat-v">${rows.length}</div></div>
    <div class="stat"><div class="stat-k">Total units</div><div class="stat-v">${units}</div></div>
    ${priced.length < rows.length
      ? `<div class="stat"><div class="stat-k">Unpriced</div><div class="stat-v">${rows.length - priced.length}</div></div>` : ''}`;

  el('out').innerHTML = rows.map((s) => `<div class="sealed-row">
      <div class="sealed-qty" title="quantity owned">×${s.qty}</div>
      <div class="sealed-main">
        <div class="sealed-n">${esc(s.name)}</div>
        <div class="sealed-s">${esc(s.set || '')}</div>
      </div>
      <div class="sealed-unit">${typeof s.price_usd === 'number' ? usd(s.price_usd) + ' ea' : '<span class="muted">no price</span>'}</div>
      <div class="sealed-line">${typeof s.line === 'number' ? usd(s.line) : '—'}</div>
      <a class="btn" href="${tcgUrl(s.search_string || s.name)}" target="_blank" rel="noopener">TCG</a>
    </div>`).join('');
}
