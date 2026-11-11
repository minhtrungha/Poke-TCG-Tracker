import { loadAll, priceIndex, usd, usd0, tcgUrl, pcUrl, imgTag, esc, langBadge,
         initChrome, dataError, byText } from './data.js';

initChrome('cards.html');
const el = (id) => document.getElementById(id);

const state = { view: 'grid', set: 'all', lang: 'all', tag: 'all', priced: 'all', q: '',
                sortK: 'id', sortDir: 1 };
let cards = [];

(async function main() {
  const d = await loadAll();
  el('err').innerHTML = dataError(d._err);
  const px = priceIndex(d.prices, d.sets);
  cards = d.cards.map((c) => ({ ...c, price: px.get(c) }));

  el('fSet').innerHTML = `<option value="all">All sets</option>` +
    [...new Set(cards.map((c) => c.set))].sort(byText)
      .map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');

  const tags = [...new Set(cards.flatMap((c) => c.tags || []))].sort();
  el('tags').innerHTML = [['all', 'All']].concat(tags.map((t) => [t, t]))
    .map(([v, l]) => `<button class="chip" data-tag="${esc(v)}" aria-pressed="${v === 'all'}">${esc(l)}</button>`).join('');
  el('tags').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tag]'); if (!b) return;
    state.tag = b.dataset.tag;
    [...el('tags').children].forEach((c) => c.setAttribute('aria-pressed', c === b));
    render();
  });

  el('vGrid').addEventListener('click', () => setView('grid'));
  el('vTable').addEventListener('click', () => setView('table'));
  el('fSet').addEventListener('change', (e) => { state.set = e.target.value; render(); });
  el('fLang').addEventListener('change', (e) => { state.lang = e.target.value; render(); });
  el('fPriced').addEventListener('change', (e) => { state.priced = e.target.value; render(); });
  el('q').addEventListener('input', (e) => { state.q = e.target.value.trim().toLowerCase(); render(); });
  render();
})();

function setView(v) {
  state.view = v;
  el('vGrid').setAttribute('aria-pressed', v === 'grid');
  el('vTable').setAttribute('aria-pressed', v === 'table');
  render();
}

function filtered() {
  return cards.filter((c) => {
    if (state.set !== 'all' && c.set !== state.set) return false;
    if (state.lang !== 'all' && (c.lang || 'EN') !== state.lang) return false;
    if (state.tag !== 'all' && !(c.tags || []).includes(state.tag)) return false;
    if (state.priced === 'yes' && typeof c.price !== 'number') return false;
    if (state.priced === 'no' && typeof c.price === 'number') return false;
    if (state.q) {
      const hay = `${c.name} ${c.number} ${c.set} ${c.rarity} ${(c.tags||[]).join(' ')}`.toLowerCase();
      if (!hay.includes(state.q)) return false;
    }
    return true;
  });
}

const COLS = [
  ['', 'thumb', null],
  ['Name', 'name', 'name'],
  ['Number', 'number', 'number'],
  ['Set', 'set', 'set'],
  ['Rarity', 'rarity', 'rarity'],
  ['Printing', 'printing', 'printing'],
  ['Lang', 'lang', 'lang'],
  ['Cond.', 'condition', 'condition'],
  ['Page', 'binder_page', 'binder_page'],
  ['Price', 'price', 'price'],
  ['Links', 'links', null],
];

function render() {
  const rows = filtered();
  const priced = rows.filter((c) => typeof c.price === 'number');
  const val = priced.reduce((s, c) => s + c.price, 0);
  const sets = new Set(rows.map((c) => c.set)).size;
  el('stats').innerHTML = `
    <div class="stat"><div class="stat-k">Cards shown</div><div class="stat-v big">${rows.length}<span style="font-size:14px;color:var(--fg-faint)"> / ${cards.length}</span></div></div>
    <div class="stat"><div class="stat-k">Sets</div><div class="stat-v">${sets}</div></div>
    <div class="stat"><div class="stat-k">With a photo</div><div class="stat-v">${rows.filter((c) => c.image).length}</div></div>
    <div class="stat"><div class="stat-k">Value shown</div><div class="stat-v">${priced.length ? usd0(val) : '—'}</div></div>`;
  el('count').textContent =
    `${rows.length} of ${cards.length} cards · ${priced.length} priced`;

  if (!rows.length) {
    el('out').innerHTML = `<div class="empty-st"><h3>No cards match</h3>
      <p>Try clearing the filters or the search box.</p></div>`;
    return;
  }

  if (state.view === 'grid') {
    el('out').className = 'grid';
    el('out').innerHTML = rows.map((c) => `<article class="card">
      <div class="pocket">${imgTag(c)}</div>
      <div class="card-b">
        <div class="card-n">${esc(c.name)} ${langBadge(c.lang)}${c.warn ? ` <span class="warn-dot" title="${esc(c.warn)}">⚠</span>` : ''}</div>
        <div class="card-m">${esc(c.number)}${c.binder_page ? ` · ${esc(c.binder_page)}` : ''}</div>
        <div class="card-s">${esc(c.set)}</div>
        <div class="card-s" style="color:var(--fg-faint)">${esc(c.rarity || '')}${c.printing ? ' · ' + esc(c.printing) : ''}</div>
        <div class="card-p${typeof c.price === 'number' ? '' : ' none'}">${typeof c.price === 'number' ? usd(c.price) : 'no price'}</div>
        <div class="card-lnks">
          <a href="${tcgUrl(c.search_string || c.name)}" target="_blank" rel="noopener">TCG</a>
          <a href="${pcUrl(c.name, c.number)}" target="_blank" rel="noopener">PC</a>
        </div>
      </div></article>`).join('');
    return;
  }

  // table view
  const dir = state.sortDir, k = state.sortK;
  rows.sort((a, b) => {
    if (k === 'price') {
      const av = a.price == null ? -Infinity : a.price, bv = b.price == null ? -Infinity : b.price;
      return (av - bv) * dir;
    }
    return byText(a[k] ?? '', b[k] ?? '') * dir;
  });

  el('out').className = 'tbl-wrap';
  el('out').innerHTML = `<table><thead><tr>${COLS.map(([lab, key, sort]) =>
      `<th${sort ? ` data-sort="${sort}"` : ''}>${esc(lab)}${sort === k ? ` <span class="ar">${dir > 0 ? '▲' : '▼'}</span>` : ''}</th>`
    ).join('')}</tr></thead><tbody>${rows.map((c) => `<tr>
      <td class="thumb">${imgTag(c, { thumb: true })}</td>
      <td>${esc(c.name)}${c.warn ? ` <span class="warn-dot" title="${esc(c.warn)}">⚠</span>` : ''}</td>
      <td class="num">${esc(c.number)}</td>
      <td>${esc(c.set)}</td>
      <td>${esc(c.rarity || '')}</td>
      <td>${esc(c.printing || '')}</td>
      <td>${langBadge(c.lang)}</td>
      <td>${esc(c.condition || '')}</td>
      <td class="num">${esc(c.binder_page || '—')}</td>
      <td class="pr">${typeof c.price === 'number' ? usd(c.price) : '—'}</td>
      <td><a class="btn" href="${tcgUrl(c.search_string || c.name)}" target="_blank" rel="noopener">TCG</a>
          <a class="btn" href="${pcUrl(c.name, c.number)}" target="_blank" rel="noopener">PC</a></td>
    </tr>`).join('')}</tbody></table>`;

  el('out').querySelectorAll('th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const s = th.dataset.sort;
      if (state.sortK === s) state.sortDir *= -1; else { state.sortK = s; state.sortDir = 1; }
      render();
    });
  });
}
