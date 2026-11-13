import { loadAll, priceIndex, usd, usd0, tcgUrl, pcUrl, esc, langBadge, initChrome, initOffline,
         dataError, getGot, setGot, wishKey, eeveeRank, byText, PLACEHOLDER,
         needImg, normNum, sprite } from './data.js';
import { bindDetails, needDetail } from './detail.js';

initOffline();
initChrome('wishlist.html');
const el = (id) => document.getElementById(id);

/* ---- state: defaults < saved (localStorage) < URL query ---- */
const DEFAULTS = { sort: 'set', max: null, src: 'all', group: true, hideGot: false, view: 'list', budget: null, q: '' };
const SAVE_KEY = 'ptcg-wish-ui';
const state = { ...DEFAULTS };
const SORTS = ['set', 'cheap', 'exp', 'name'], SRCS = ['all', 'set', 'want'], VIEWS = ['list', 'cards'];
const num = (v) => { const n = parseFloat(v); return isFinite(n) && n >= 0 ? n : null; };

function loadState() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') || {}; } catch (_) {}
  const u = new URLSearchParams(location.search);
  const pick = (k, urlKey, parse) => {
    if (u.has(urlKey)) { const v = parse(u.get(urlKey)); if (v !== undefined) return v; }
    if (k in saved) { const v = parse(saved[k]); if (v !== undefined) return v; }
    return DEFAULTS[k];
  };
  const oneOf = (list) => (v) => (list.includes(String(v)) ? String(v) : undefined);
  const bool = (v) => (v === true || v === '1' ? true : v === false || v === '0' ? false : undefined);
  const money = (v) => (v === null ? null : num(v) ?? undefined);
  state.view = pick('view', 'view', oneOf(VIEWS));
  state.sort = pick('sort', 'sort', oneOf(SORTS));
  state.src = pick('src', 'src', oneOf(SRCS));
  state.group = pick('group', 'group', bool);
  state.hideGot = pick('hideGot', 'hide', bool);
  state.max = pick('max', 'max', money);
  state.budget = pick('budget', 'budget', money);
  state.q = u.get('q') || '';                          // search is per-visit, URL only
}
function saveState() {
  const { q, ...keep } = state;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(keep)); } catch (_) {}
  const u = new URLSearchParams();
  if (state.view !== DEFAULTS.view) u.set('view', state.view);
  if (state.sort !== DEFAULTS.sort) u.set('sort', state.sort);
  if (state.src !== DEFAULTS.src) u.set('src', state.src);
  if (state.group !== DEFAULTS.group) u.set('group', state.group ? '1' : '0');
  if (state.hideGot !== DEFAULTS.hideGot) u.set('hide', state.hideGot ? '1' : '0');
  if (state.max != null) u.set('max', String(state.max));
  if (state.budget != null) u.set('budget', String(state.budget));
  if (state.q) u.set('q', state.q);
  const qs = u.toString();
  try { history.replaceState(history.state, '', location.pathname + (qs ? `?${qs}` : '') + location.hash); } catch (_) {}
}
const filtersActive = () => !!(state.q || state.src !== 'all' || state.max != null || state.hideGot || state.budget != null);

let items = [], got = getGot(), needMap = {}, spriteMap = {};
let shownRows = [], idx = new Map(), checked = null, plan = new Set();

(async function main() {
  loadState();
  const d = await loadAll();
  el('err').innerHTML = dataError(d._err);
  const px = priceIndex(d.prices, d.sets);
  needMap = d['need-images'] || {};
  spriteMap = d.sprites || {};
  checked = d.prices && d.prices.checked_date;
  bindDetails(el('out'), () => shownRows.map((i) => needDetail(i, {
    img: needMap[i.imgKey] ? `images/need/${needMap[i.imgKey]}` : null,
    checked, sprites: spriteMap, got: got.has(i.key) })));

  // Source 1: missing slots in tracked sets.
  const fromSets = (d.sets || []).flatMap((s) =>
    (s.slots || []).filter((x) => x.card_id == null).map((x) => ({
      name: x.name, number: x.number, set: s.name, setKey: s.key,
      imgKey: `${s.key}|${String(x.number).trim().toUpperCase()}`,
      lang: s.lang || 'EN', rarity: '', src: 'set',
      price: px.getSlot(s.key, x.number),
      search_string: `${x.name} ${x.number}`,
    })));

  // Source 2: standalone wants. Entries already owned are excluded from display.
  const standalone = (d.wishlist || []).filter((w) => !w.owned).map((w) => ({
    name: w.name, number: w.number, set: w.set, lang: w.lang || 'EN',
    rarity: w.rarity || '', illustrator: w.illustrator || '', src: 'want',
    imgKey: `want|${w.name}|${normNum(w.number)}`,
    price: typeof w.price_usd === 'number' ? w.price_usd : px.get(w),
    search_string: w.search_string || `${w.name} ${w.number}`,
  }));

  items = [...fromSets, ...standalone].map((i) => ({
    ...i, key: wishKey(i), hay: `${i.name} ${i.number} ${i.set}`.toLowerCase(),
  }));

  syncControls();
  el('q').addEventListener('input', (e) => { state.q = e.target.value.trim(); update(); });
  el('q').addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (e.target.value) { e.preventDefault(); e.target.value = ''; state.q = ''; update(); }
    else e.target.blur();
  });
  // "/" jumps to search from anywhere that isn't already a text field.
  addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t.closest && t.closest('input, textarea, select, [contenteditable], dialog[open]')) return;
    e.preventDefault(); el('q').focus(); el('q').select();
  });
  el('fSort').addEventListener('change', (e) => { state.sort = e.target.value; update(); });
  el('fSrc').addEventListener('change', (e) => { state.src = e.target.value; update(); });
  el('fMax').addEventListener('input', (e) => { state.max = num(e.target.value); update(); });
  el('fBudget').addEventListener('input', (e) => { state.budget = num(e.target.value); update(); });
  el('vList').addEventListener('click', () => { state.view = 'list'; update(); });
  el('vCards').addEventListener('click', () => { state.view = 'cards'; update(); });
  el('fGroup').addEventListener('click', () => { state.group = !state.group; update(); });
  el('fHide').addEventListener('click', () => { state.hideGot = !state.hideGot; update(); });
  el('clearBtn').addEventListener('click', clearFilters);
  el('out').addEventListener('click', (e) => { if (e.target.closest('[data-clear]')) clearFilters(); });
  el('copyBtn').addEventListener('click', copyList);

  // Keep tabs in sync.
  addEventListener('storage', (e) => { if (e.key === 'ptcg-got') { got = getGot(); render(); } });
  render();
})();

function syncControls() {
  if (document.activeElement !== el('q')) el('q').value = state.q;
  el('fSort').value = state.sort;
  el('fSrc').value = state.src;
  if (num(el('fMax').value) !== state.max) el('fMax').value = state.max ?? '';
  if (num(el('fBudget').value) !== state.budget) el('fBudget').value = state.budget ?? '';
  el('maxOut').textContent = state.max == null ? 'no limit' : usd0(state.max);
  el('vList').setAttribute('aria-pressed', state.view === 'list');
  el('vCards').setAttribute('aria-pressed', state.view === 'cards');
  el('fGroup').setAttribute('aria-pressed', state.group);
  el('fHide').setAttribute('aria-pressed', state.hideGot);
  el('clearBtn').disabled = !filtersActive();
}
function update() { syncControls(); saveState(); render(); }
function clearFilters() {
  Object.assign(state, { q: '', src: 'all', max: null, hideGot: false, budget: null });
  update();
  el('q').focus();
}

function filtered() {
  const q = state.q.toLowerCase();
  return items.filter((i) => {
    if (q && !i.hay.includes(q)) return false;
    if (state.src !== 'all' && i.src !== state.src) return false;
    if (state.max != null && !(typeof i.price === 'number' && i.price <= state.max)) return false;
    if (state.hideGot && got.has(i.key)) return false;
    return true;
  });
}

function sortRows(rows) {
  const n = (p) => (typeof p === 'number' ? p : Infinity);
  const cmp = {
    set: (a, b) => byText(a.set, b.set) || eeveeRank(a.name) - eeveeRank(b.name) || byText(a.number, b.number),
    cheap: (a, b) => n(a.price) - n(b.price),
    exp: (a, b) => (typeof b.price === 'number' ? b.price : -Infinity) - (typeof a.price === 'number' ? a.price : -Infinity),
    name: (a, b) => byText(a.name, b.name),
  }[state.sort];
  return rows.slice().sort(cmp);
}

/* Budget plan: cheapest-first greedy over the shown, not-got, priced cards.
   Once the next-cheapest card no longer fits, nothing pricier can either. */
function budgetPlan(rows, budget) {
  const pool = rows.filter((r) => !got.has(r.key) && typeof r.price === 'number')
    .sort((a, b) => a.price - b.price || byText(a.name, b.name));
  const pick = []; let spent = 0;
  for (const r of pool) {
    if (spent + r.price > budget + 1e-9) break;
    pick.push(r); spent += r.price;
  }
  return { pick, spent, pool };
}

const planChip = (i) => (plan.has(i) ? '<span class="tag in-plan-tag">in budget</span>' : '');

function cardTile(i) {
  const isGot = got.has(i.key);
  return `<article class="card wl-card${isGot ? ' got' : ''}${plan.has(i) ? ' in-plan' : ''}" data-i="${idx.get(i)}"><button type="button" class="card-hit" data-open aria-label="Details for ${esc(i.name)} ${esc(i.number)}"></button>
    <div class="pocket">${needImg(needMap, i.imgKey, `${i.name} ${i.number}`)}
      ${isGot ? '<span class="need-chip got-chip">GOT</span>' : '<span class="need-chip">NEED</span>'}</div>
    <div class="card-b">
      <div class="card-n">${esc(i.name)} ${langBadge(i.lang)}${sprite(spriteMap, i.name, 'name-sprite')}</div>
      <div class="card-m">${esc(i.number)}</div>
      <div class="card-s">${esc(i.set)}</div>
      <div class="card-p${typeof i.price === 'number' ? '' : ' none'}">${typeof i.price === 'number' ? usd(i.price) : 'no price'}${planChip(i)}</div>
      <div class="card-lnks">
        <a href="${tcgUrl(i.search_string)}" target="_blank" rel="noopener">TCG</a>
        <button class="btn${isGot ? ' on' : ''}" data-got="${esc(i.key)}">${isGot ? '✓' : 'Got it'}</button>
      </div>
    </div></article>`;
}

function row(i) {
  const isGot = got.has(i.key);
  return `<div class="wl-row${isGot ? ' got' : ''}${plan.has(i) ? ' in-plan' : ''}" data-i="${idx.get(i)}"><button type="button" class="card-hit" data-open aria-label="Details for ${esc(i.name)} ${esc(i.number)}"></button>
    <div class="wl-img">${needImg(needMap, i.imgKey, `${i.name} ${i.number}`)}</div>
    <div class="wl-main">
      <div class="wl-n">${esc(i.name)} ${langBadge(i.lang)}${sprite(spriteMap, i.name, 'name-sprite')}
        ${i.src === 'set' ? '<span class="tag">set slot</span>' : ''}${planChip(i)}</div>
      <div class="wl-m">${esc(i.number)}${i.rarity ? ` · ${esc(i.rarity)}` : ''}</div>
      <div class="wl-s">${esc(i.set)}${i.illustrator ? ` · ${esc(i.illustrator)}` : ''}</div>
    </div>
    <div class="wl-pr${typeof i.price === 'number' ? '' : ' none'}">${typeof i.price === 'number' ? usd(i.price) : 'no price'}</div>
    <div class="wl-act">
      <a class="btn lnk" href="${tcgUrl(i.search_string)}" target="_blank" rel="noopener">TCG</a>
      <a class="btn lnk" href="${pcUrl(i.name, i.number)}" target="_blank" rel="noopener">PC</a>
      <button class="btn${isGot ? ' on' : ''}" data-got="${esc(i.key)}">${isGot ? '✓ Got it' : 'Got it'}</button>
    </div></div>`;
}

function render() {
  const rows = filtered();
  shownRows = sortRows(rows);
  idx = new Map(shownRows.map((r, n) => [r, n]));
  const priced = rows.filter((r) => typeof r.price === 'number');
  const openRows = rows.filter((r) => !got.has(r.key));
  const openPriced = openRows.filter((r) => typeof r.price === 'number');
  const openTot = openPriced.reduce((s, r) => s + r.price, 0);

  el('stats').innerHTML = `
    <div class="stat"><div class="stat-k">Cards wanted</div><div class="stat-v">${openRows.length}</div></div>
    <div class="stat"><div class="stat-k">Est. total cost</div><div class="stat-v big">${priced.length ? usd0(openTot) : '—'}</div></div>
    <div class="stat"><div class="stat-k">Marked got</div><div class="stat-v">${rows.length - openRows.length}</div></div>
    <div class="stat"><div class="stat-k">Priced</div><div class="stat-v">${priced.length}<span style="font-size:14px;color:var(--fg-faint)"> / ${rows.length}</span></div></div>`;

  // budget + max-price helper
  plan = new Set();
  const notes = [];
  if (state.max != null) {
    notes.push(`<div class="wl-note"><b>${openPriced.length}</b> wanted card${openPriced.length === 1 ? '' : 's'} at
      <b>${usd0(state.max)}</b> or less · <b>${usd(openTot)}</b> for all of them</div>`);
  }
  if (state.budget != null) {
    const { pick, spent, pool } = budgetPlan(shownRows, state.budget);
    plan = new Set(pick);
    notes.push(`<div class="wl-note plan"><span class="wl-plan-k">Budget plan</span>
      <span><b>${pick.length}</b> of ${pool.length} card${pool.length === 1 ? '' : 's'} for <b>${usd(spent)}</b>
      of ${usd(state.budget)} · ${usd(Math.max(0, state.budget - spent))} left</span>
      <span class="wl-note-sub">Picked cheapest-first from what's shown, so you get the most cards for the money. Highlighted below.</span></div>`);
  }
  el('budgetOut').innerHTML = notes.join('');
  el('copyLab').textContent = state.budget != null ? `Copy budget list (${plan.size})` : 'Copy shopping list';
  el('copyBtn').disabled = state.budget != null ? !plan.size : !openRows.length;

  el('count').textContent = `${rows.length} item${rows.length === 1 ? '' : 's'}` +
    (priced.length < rows.length ? ` · ${rows.length - priced.length} without a price` : '') +
    (state.q ? ` · matching “${state.q}”` : '');

  if (!rows.length) {
    el('out').innerHTML = filtersActive()
      ? `<div class="empty-st"><h3>No cards match</h3>
          <p>${state.q ? `Nothing on the list matches “${esc(state.q)}”` : 'The filters are hiding everything'}${
            state.max != null ? ` at ${usd0(state.max)} or less` : ''}.</p>
          <p style="margin-top:14px"><button type="button" class="btn" data-clear>Clear filters</button></p></div>`
      : `<div class="empty-st"><h3>Nothing left to hunt</h3>
          <p>Every set slot is filled and there are no standalone wants. Say
          <strong>“add to wishlist”</strong> in Claude Code to add a card you want.</p></div>`;
  } else if (state.group && state.sort === 'set') {
    const groups = new Map();
    for (const i of shownRows) {
      if (!groups.has(i.set)) groups.set(i.set, []);
      groups.get(i.set).push(i);
    }
    el('out').innerHTML = [...groups].map(([set, list]) => {
      const gp = list.filter(x => typeof x.price === 'number').reduce((s, x) => s + x.price, 0);
      const body = state.view === 'cards'
        ? `<div class="grid">${list.map(cardTile).join('')}</div>`
        : list.map(row).join('');
      return `<div class="wl-grp"><div class="sec-h">${esc(set)} · ${list.length}${gp ? ` · ${usd0(gp)}` : ''}</div>${body}</div>`;
    }).join('');
  } else {
    el('out').innerHTML = state.view === 'cards'
      ? `<div class="grid">${shownRows.map(cardTile).join('')}</div>`
      : shownRows.map(row).join('');
  }

  el('out').querySelectorAll('[data-got]').forEach((b) => {
    b.addEventListener('click', () => {
      const k = b.dataset.got;
      if (got.has(k)) got.delete(k); else got.add(k);
      setGot(got);
      render();
    });
  });
}

/* ---- copy shopping list ---- */
function listText(rows, { title, checkedDate } = {}) {
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.set)) groups.set(r.set, []);
    groups.get(r.set).push(r);
  }
  const priced = rows.filter((r) => typeof r.price === 'number');
  const total = priced.reduce((s, r) => s + r.price, 0);
  const lines = [`${title} — ${rows.length} card${rows.length === 1 ? '' : 's'} · est. ${usd(total)}` +
    (checkedDate ? ` (TCGplayer market, ${checkedDate})` : '')];
  for (const [set, list] of groups) {
    lines.push('', set);
    for (const r of list) {
      lines.push(`- ${r.name} ${r.number} [${r.lang || 'EN'}] — ${typeof r.price === 'number' ? usd(r.price) : 'no price'}`);
    }
  }
  lines.push('', `Total: ${usd(total)}${priced.length < rows.length ? ` (${rows.length - priced.length} without a price)` : ''}`);
  return lines.join('\n');
}

async function copyList() {
  const rows = state.budget != null
    ? shownRows.filter((r) => plan.has(r))
    : shownRows.filter((r) => !got.has(r.key));
  if (!rows.length) return;
  const text = listText(rows, {
    title: state.budget != null ? `Poké TCG buy list (budget ${usd0(state.budget)})` : 'Poké TCG wishlist',
    checkedDate: checked,
  });
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch (_) {}
  if (!ok) {
    // Fallback: a hidden textarea + execCommand('copy').
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'wl-copy-fallback';
    document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch (_) {}
    ta.remove();
  }
  toast(ok ? `Copied ${rows.length} card${rows.length === 1 ? '' : 's'} to the clipboard`
           : 'Could not copy — your browser blocked clipboard access');
}

let toastT = 0;
function toast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2600);
}
