import { loadAll, priceIndex, usd, usd0, tcgUrl, pcUrl, imgTag, esc, langBadge,
         initChrome, initOffline, dataError, byText, sprite } from './data.js';
import { bindDetails, ownedDetail } from './detail.js';

initOffline();
initChrome('cards.html');
const el = (id) => document.getElementById(id);

/* ---- view state --------------------------------------------------------
   Remembered across visits (localStorage) and mirrored into the URL query so
   a filtered view can be bookmarked or shared. A URL that carries any state
   wins over what was remembered; replaceState only, so Back is untouched. */
const DEFAULTS = { view: 'grid', set: 'all', lang: 'all', tag: 'all', priced: 'all', q: '',
                   sort: 'default', sortK: 'id', sortDir: 1 };
const SORTS = ['default', 'recent', 'price-desc', 'price-asc', 'name', 'set', 'number'];
const TABLE_KEYS = ['id', 'name', 'number', 'set', 'rarity', 'printing', 'lang', 'condition', 'binder_page', 'price'];
const STORE = 'ptcg-cards-view';
// URL param name ↔ state key
const PARAMS = { v: 'view', set: 'set', lang: 'lang', tag: 'tag', price: 'priced', q: 'q',
                 sort: 'sort', col: 'sortK', dir: 'sortDir' };
const FILTER_KEYS = ['set', 'lang', 'tag', 'priced', 'q'];

const state = { ...DEFAULTS };
let cards = [], shownRows = [], ctx = {};

function readState() {
  const fromUrl = {};
  const qs = new URLSearchParams(location.search);
  for (const [p, k] of Object.entries(PARAMS)) if (qs.has(p)) fromUrl[k] = qs.get(p);
  let saved = {};
  if (!Object.keys(fromUrl).length) {
    try { saved = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (_) { saved = {}; }
  }
  Object.assign(state, DEFAULTS, saved, fromUrl);
  state.sortDir = Number(state.sortDir) === -1 ? -1 : 1;
  state.q = String(state.q || '').slice(0, 80);
}
function validate(setNames, tagNames) {
  if (!['grid', 'table'].includes(state.view)) state.view = DEFAULTS.view;
  if (state.set !== 'all' && !setNames.has(state.set)) state.set = 'all';
  if (!['all', 'EN', 'JP'].includes(state.lang)) state.lang = 'all';
  if (state.tag !== 'all' && !tagNames.has(state.tag)) state.tag = 'all';
  if (!['all', 'yes', 'no'].includes(state.priced)) state.priced = 'all';
  if (!SORTS.includes(state.sort)) state.sort = DEFAULTS.sort;
  if (!TABLE_KEYS.includes(state.sortK)) state.sortK = DEFAULTS.sortK;
}
function saveState() {
  const keep = {};
  for (const k of Object.keys(DEFAULTS)) if (state[k] !== DEFAULTS[k]) keep[k] = state[k];
  try { localStorage.setItem(STORE, JSON.stringify(keep)); } catch (_) {}
  const qs = new URLSearchParams();
  for (const [p, k] of Object.entries(PARAMS)) {
    if (k === 'sortK' || k === 'sortDir') { if (state.view !== 'table') continue; }
    if (k === 'sort' && state.view !== 'grid') continue;
    if (state[k] !== DEFAULTS[k]) qs.set(p, String(state[k]));
  }
  const url = location.pathname + (qs.toString() ? `?${qs}` : '') + location.hash;
  try { history.replaceState(history.state, '', url); } catch (_) {}
}
const isFiltered = () => FILTER_KEYS.some((k) => state[k] !== DEFAULTS[k]);

(async function main() {
  const d = await loadAll();
  el('err').innerHTML = dataError(d._err);
  const px = priceIndex(d.prices, d.sets);
  cards = d.cards.map((c) => ({ ...c, price: px.get(c) }));
  ctx = { checked: d.prices && d.prices.checked_date, sprites: d.sprites || {} };
  bindDetails(el('out'), () => shownRows.map((c) => ownedDetail(c, { price: c.price, ...ctx })));

  const setNames = [...new Set(cards.map((c) => c.set))].sort(byText);
  const tags = [...new Set(cards.flatMap((c) => c.tags || []))].sort();
  readState();
  validate(new Set(setNames), new Set(tags));

  el('fSet').innerHTML = `<option value="all">All sets</option>` +
    setNames.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  el('tags').innerHTML = [['all', 'All']].concat(tags.map((t) => [t, t]))
    .map(([v, l]) => `<button class="chip" data-tag="${esc(v)}" aria-pressed="false">${esc(l)}</button>`).join('');
  el('tags').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tag]'); if (!b) return;
    state.tag = b.dataset.tag;
    render();
  });

  el('vGrid').addEventListener('click', () => { state.view = 'grid'; render(); });
  el('vTable').addEventListener('click', () => { state.view = 'table'; render(); });
  el('fSort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  el('fSet').addEventListener('change', (e) => { state.set = e.target.value; render(); });
  el('fLang').addEventListener('change', (e) => { state.lang = e.target.value; render(); });
  el('fPriced').addEventListener('change', (e) => { state.priced = e.target.value; render(); });
  el('q').addEventListener('input', (e) => { state.q = e.target.value.slice(0, 80); render(); });
  // Esc in the box clears it (and keeps focus there).
  el('q').addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el('q').value) {
      e.preventDefault(); e.stopPropagation();
      el('q').value = ''; state.q = ''; render();
    }
  });
  el('clearF').addEventListener('click', clearFilters);
  el('out').addEventListener('click', (e) => { if (e.target.closest('[data-clear]')) clearFilters(); });

  // "/" focuses search, unless the user is typing somewhere or a dialog is open.
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.querySelector('dialog[open]')) return;
    e.preventDefault();
    el('q').focus();
    el('q').select();
  });

  render();
})();

function clearFilters() {
  for (const k of FILTER_KEYS) state[k] = DEFAULTS[k];
  render();
  el('q').focus({ preventScroll: true });
}

/* reflect state into the controls (after URL/localStorage load, or a clear) */
function syncControls() {
  el('vGrid').setAttribute('aria-pressed', state.view === 'grid');
  el('vTable').setAttribute('aria-pressed', state.view === 'table');
  el('sortFld').hidden = state.view !== 'grid';      // the table sorts by its headers
  el('fSort').value = state.sort;
  el('fSet').value = state.set;
  el('fLang').value = state.lang;
  el('fPriced').value = state.priced;
  if (el('q').value !== state.q) el('q').value = state.q;
  [...el('tags').children].forEach((c) => c.setAttribute('aria-pressed', c.dataset.tag === state.tag));
  el('clearF').hidden = !isFiltered();
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  return cards.filter((c) => {
    if (state.set !== 'all' && c.set !== state.set) return false;
    if (state.lang !== 'all' && (c.lang || 'EN') !== state.lang) return false;
    if (state.tag !== 'all' && !(c.tags || []).includes(state.tag)) return false;
    if (state.priced === 'yes' && typeof c.price !== 'number') return false;
    if (state.priced === 'no' && typeof c.price === 'number') return false;
    if (q) {
      const hay = `${c.name} ${c.number} ${c.set} ${c.rarity} ${(c.tags||[]).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/* grid sort — unpriced cards always sink to the end of a price sort */
const priceOr = (p, fallback) => (typeof p === 'number' ? p : fallback);
const GRID_SORT = {
  default: (a, b) => a.id - b.id,
  recent: (a, b) => b.id - a.id,
  'price-desc': (a, b) => priceOr(b.price, -Infinity) - priceOr(a.price, -Infinity) || a.id - b.id,
  'price-asc': (a, b) => priceOr(a.price, Infinity) - priceOr(b.price, Infinity) || a.id - b.id,
  name: (a, b) => byText(a.name, b.name) || byText(a.number, b.number),
  set: (a, b) => byText(a.set, b.set) || byText(a.number, b.number),
  number: (a, b) => byText(a.number, b.number) || byText(a.name, b.name),
};

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
  syncControls();
  saveState();
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
    `${rows.length} of ${cards.length} cards · ${priced.length} priced${isFiltered() ? ' · filtered' : ''}`;

  if (!rows.length) {
    shownRows = [];
    el('out').className = 'grid';
    el('out').innerHTML = `<div class="empty-st"><h3>No cards match</h3>
      <p>${state.q ? `Nothing matches “${esc(state.q.trim())}” with these filters.` : 'These filters leave nothing to show.'}</p>
      ${isFiltered() ? '<p style="margin-top:14px"><button type="button" class="btn" data-clear>✕ Clear filters</button></p>' : ''}</div>`;
    return;
  }

  if (state.view === 'grid') {
    rows.sort(GRID_SORT[state.sort] || GRID_SORT.default);
    el('out').className = 'grid';
    shownRows = rows;
    el('out').innerHTML = rows.map((c, i) => `<article class="card" data-i="${i}"><button type="button" class="card-hit" data-open aria-label="Details for ${esc(c.name)} ${esc(c.number)}"></button>
      <div class="pocket">${imgTag(c)}</div>
      <div class="card-b">
        <div class="card-n">${esc(c.name)} ${langBadge(c.lang)}${sprite(ctx.sprites, c.name, 'name-sprite')}${c.warn ? ` <span class="warn-dot" title="${esc(c.warn)}">⚠</span>` : ''}</div>
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
    if (k === 'id') return (a.id - b.id) * dir;
    return byText(a[k] ?? '', b[k] ?? '') * dir;
  });

  shownRows = rows;
  el('out').className = 'tbl-wrap';
  el('out').innerHTML = `<table><thead><tr>${COLS.map(([lab, key, sort]) =>
      `<th${sort ? ` data-sort="${sort}" tabindex="0" aria-sort="${sort === k ? (dir > 0 ? 'ascending' : 'descending') : 'none'}"` : ''}>${esc(lab)}${sort === k ? ` <span class="ar">${dir > 0 ? '▲' : '▼'}</span>` : ''}</th>`
    ).join('')}</tr></thead><tbody>${rows.map((c, i) => `<tr data-i="${i}">
      <td class="thumb">${imgTag(c, { thumb: true })}</td>
      <td><span class="td-name"><button type="button" class="lnk-btn" data-open>${esc(c.name)}</button>${sprite(ctx.sprites, c.name, 'name-sprite')}</span>${c.warn ? ` <span class="warn-dot" title="${esc(c.warn)}">⚠</span>` : ''}</td>
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
    const go = () => {
      const s = th.dataset.sort;
      if (state.sortK === s) state.sortDir *= -1; else { state.sortK = s; state.sortDir = 1; }
      render();
      const again = el('out').querySelector(`th[data-sort="${s}"]`);
      if (again) again.focus({ preventScroll: true });
    };
    th.addEventListener('click', go);
    th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
}
