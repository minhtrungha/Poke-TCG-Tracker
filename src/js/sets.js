import { loadAll, priceIndex, usd0, imgTag, esc, langBadge, byText,
         initChrome, initOffline, dataError, needImg, sprite } from './data.js';
import { bindDetails, ownedDetail, needDetail } from './detail.js';

initOffline();
initChrome('sets.html');
const el = (id) => document.getElementById(id);

/* lang / pocket filter / set order / collapsed sets — remembered per browser */
const STORE = 'ptcg-sets-view';
const DEFAULTS = { lang: 'all', only: 'all', order: 'default', collapsed: [] };
const state = { ...DEFAULTS, collapsed: new Set() };
let sets = [], byId = new Map(), px = null, needMap = {};
let pocketItems = [], ctx = {};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function loadState() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (_) { s = {}; }
  if (['all', 'EN', 'JP'].includes(s.lang)) state.lang = s.lang;
  if (['all', 'missing', 'owned'].includes(s.only)) state.only = s.only;
  if (['default', 'most', 'least', 'cost', 'name'].includes(s.order)) state.order = s.order;
  if (Array.isArray(s.collapsed)) state.collapsed = new Set(s.collapsed.map(String));
}
function saveState() {
  try {
    localStorage.setItem(STORE, JSON.stringify({
      lang: state.lang, only: state.only, order: state.order, collapsed: [...state.collapsed],
    }));
  } catch (_) {}
}

(async function main() {
  const d = await loadAll();
  el('err').innerHTML = dataError(d._err);
  px = priceIndex(d.prices, d.sets);
  byId = new Map(d.cards.map((c) => [c.id, c]));
  sets = (d.sets || []).map((s, i) => ({ ...s, _i: i }));
  needMap = d['need-images'] || {};
  ctx = { checked: d.prices && d.prices.checked_date, sprites: d.sprites || {} };
  bindDetails(el('out'), () => pocketItems);
  loadState();
  // forget collapsed keys for sets that no longer exist
  const keys = new Set(sets.map((s) => s.key));
  state.collapsed = new Set([...state.collapsed].filter((k) => keys.has(k)));

  el('fLang').value = state.lang;
  el('fOnly').value = state.only;
  el('fOrder').value = state.order;
  el('fLang').addEventListener('change', (e) => { state.lang = e.target.value; render(); });
  el('fOnly').addEventListener('change', (e) => { state.only = e.target.value; render(); });
  el('fOrder').addEventListener('change', (e) => { state.order = e.target.value; render(); });
  el('toggleAll').addEventListener('click', () => {
    const shown = visibleSets();
    const anyOpen = shown.some((s) => !state.collapsed.has(s.key));
    for (const s of shown) anyOpen ? state.collapsed.add(s.key) : state.collapsed.delete(s.key);
    render();
  });
  // header toggles (delegated; they are not detail-sheet triggers)
  el('out').addEventListener('click', (e) => {
    const b = e.target.closest('[data-toggle]');
    if (!b) return;
    const k = b.dataset.toggle;
    state.collapsed.has(k) ? state.collapsed.delete(k) : state.collapsed.add(k);
    render();
    const again = el('out').querySelector(`[data-toggle="${CSS.escape(k)}"]`);
    if (again) again.focus({ preventScroll: true });
  });
  // overview: jump to a set (opening it if it was collapsed)
  el('overview').addEventListener('click', (e) => {
    const b = e.target.closest('[data-jump]');
    if (!b) return;
    const k = b.dataset.jump;
    if (state.collapsed.has(k)) { state.collapsed.delete(k); render(); }
    const target = document.getElementById(`set-${k}`);
    if (!target) return;
    target.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    const t = target.querySelector('[data-toggle]');
    if (t) t.focus({ preventScroll: true });
  });
  render();
})();

/* per-set numbers, computed once per render */
function stats(s) {
  const sl = s.slots || [];
  const total = sl.length;
  const have = sl.filter((x) => x.card_id != null).length;
  const missing = sl.filter((x) => x.card_id == null);
  const prices = missing.map((x) => px.getSlot(s.key, x.number));
  const cost = prices.filter((p) => typeof p === 'number').reduce((a, b) => a + b, 0);
  const unpriced = prices.filter((p) => typeof p !== 'number').length;
  return { total, have, pct: total ? have / total : 0, done: have === total && total > 0, cost, unpriced, missing: missing.length };
}

const ORDER = {
  default: (a, b) => a.s._i - b.s._i,
  most: (a, b) => b.st.pct - a.st.pct || byText(a.s.name, b.s.name),
  least: (a, b) => a.st.pct - b.st.pct || byText(a.s.name, b.s.name),
  // cheapest unfinished set first; finished sets (nothing to buy) go last
  cost: (a, b) => (a.st.done - b.st.done)
    || ((a.st.unpriced === a.st.missing) - (b.st.unpriced === b.st.missing))   // no known cost → after priced
    || a.st.cost - b.st.cost || byText(a.s.name, b.s.name),
  name: (a, b) => byText(a.s.name, b.s.name),
};

function visibleSets() {
  return sets.filter((s) => state.lang === 'all' || (s.lang || 'EN') === state.lang);
}

function render() {
  saveState();
  const shown = visibleSets().map((s) => ({ s, st: stats(s) })).sort(ORDER[state.order] || ORDER.default);

  const slots = shown.flatMap(({ s }) => s.slots || []);
  const filled = slots.filter((x) => x.card_id != null).length;
  const missCost = shown.reduce((t, { st }) => t + st.cost, 0);

  el('stats').innerHTML = `
    <div class="stat"><div class="stat-k">Sets tracked</div><div class="stat-v">${shown.length}</div></div>
    <div class="stat"><div class="stat-k">Slots filled</div><div class="stat-v big">${filled}<span style="font-size:14px;color:var(--fg-faint)"> / ${slots.length}</span></div></div>
    <div class="stat"><div class="stat-k">Complete sets</div><div class="stat-v">${shown.filter(({ st }) => st.done).length}</div></div>
    ${missCost > 0 ? `<div class="stat"><div class="stat-k">Cost to finish</div><div class="stat-v">${usd0(missCost)}</div></div>` : ''}`;

  const anyOpen = shown.some(({ s }) => !state.collapsed.has(s.key));
  el('toggleAll').textContent = anyOpen ? 'Collapse all' : 'Expand all';
  el('toggleAll').setAttribute('aria-label', anyOpen ? 'Collapse all sets' : 'Expand all sets');
  el('toggleAll').hidden = !shown.length;

  // overview: one chip per set, in the current order
  el('overview').innerHTML = shown.length ? shown.map(({ s, st }) => {
    const pct = Math.round(st.pct * 100);
    return `<button type="button" class="ov${st.done ? ' done' : ''}" data-jump="${esc(s.key)}"
        aria-label="${esc(s.name)}: ${st.have} of ${st.total}, ${pct}% complete — jump to set">
      <span class="ov-t">${esc(s.name)}</span>
      <span class="ov-n">${st.done ? '✓' : `${pct}%`}</span>
      <span class="ov-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
    </button>`;
  }).join('') : '';

  pocketItems = [];
  el('out').innerHTML = shown.length ? shown.map(({ s, st }) => {
    let sl = s.slots || [];
    if (state.only === 'missing') sl = sl.filter((x) => x.card_id == null);
    if (state.only === 'owned') sl = sl.filter((x) => x.card_id != null);
    const pct = Math.round(st.pct * 100);
    const open = !state.collapsed.has(s.key);
    const bodyId = `setb-${s.key}`;

    const pockets = open ? sl.map((slot) => {
      const card = slot.card_id != null ? byId.get(slot.card_id) : null;
      const i = pocketItems.length;
      if (card) {
        // Owned pocket -> detail sheet (with PriceCharting + TCGplayer links)
        pocketItems.push(ownedDetail(card, { price: px.get(card), ...ctx }));
        return `<button type="button" class="pk" data-i="${i}" data-open
                   aria-label="${esc(card.name)} ${esc(card.number)}, owned — details">
          <span class="pk-img">${imgTag(card, { thumb: true })}</span>
          <span class="pk-b"><span class="pk-row"><span class="pk-n">${esc(card.name)}</span>${sprite(ctx.sprites, card.name, 'name-sprite')}</span>
            <span class="pk-num">${esc(slot.number)}</span></span></button>`;
      }
      // Missing pocket -> detail sheet (NEED)
      const p = px.getSlot(s.key, slot.number);
      const nkey = `${s.key}|${String(slot.number).trim().toUpperCase()}`;
      pocketItems.push(needDetail(
        { name: slot.name, number: slot.number, set: s.name, lang: s.lang || 'EN', src: 'set', price: p,
          search_string: `${slot.name} ${slot.number}` },
        { img: needMap[nkey] ? `images/need/${needMap[nkey]}` : null, ...ctx }));
      return `<button type="button" class="pk miss" data-i="${i}" data-open
                 aria-label="${esc(slot.name)} ${esc(slot.number)}, still needed — details">
        <span class="pk-img"><span class="need-chip">NEED</span>${
          needImg(needMap, nkey, `${slot.name} ${slot.number}`)}</span>
        <span class="pk-b"><span class="pk-row"><span class="pk-n">${esc(slot.name)}</span>${sprite(ctx.sprites, slot.name, 'name-sprite')}</span>
          <span class="pk-num">${esc(slot.number)}</span>
          ${typeof p === 'number' ? `<span class="pk-pr">${usd0(p)}</span>` : ''}</span></button>`;
    }).join('') : '';

    const costChip = st.done
      ? '<span class="set-cost done">Complete</span>'
      : st.cost > 0
        ? `<span class="set-cost" title="${st.missing} missing${st.unpriced ? `, ${st.unpriced} without a price` : ''}">${usd0(st.cost)} to finish${st.unpriced ? '+' : ''}</span>`
        : `<span class="set-cost none">${st.missing} missing · no prices</span>`;

    return `<section class="set${open ? '' : ' collapsed'}" id="set-${esc(s.key)}">
      <div class="set-h">
        <button type="button" class="set-tg" data-toggle="${esc(s.key)}" aria-expanded="${open}" aria-controls="${esc(bodyId)}">
          <svg class="set-chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 10l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span class="set-t">${esc(s.name)}</span></button>${langBadge(s.lang)}
        ${costChip}
        <span class="set-ct${st.done ? ' done' : ''}">${st.have} / ${st.total}${st.done ? ' ✓' : ''}</span></div>
      <div class="pbar"><i class="${st.done ? 'done' : ''}" style="width:${pct}%"></i></div>
      <div class="set-body" id="${esc(bodyId)}"${open ? '' : ' hidden'}>
        ${s.note ? `<p class="set-note">${esc(s.note)}</p>` : ''}
        ${sl.length ? `<div class="pockets">${pockets}</div>`
          : `<p class="set-note" style="margin:0">Nothing to show with this filter.</p>`}
      </div>
    </section>`;
  }).join('') : `<div class="empty-st"><h3>No sets in this language</h3><p>Switch the language filter back to All.</p></div>`;
}
