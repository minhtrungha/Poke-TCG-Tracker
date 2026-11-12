import { loadAll, priceIndex, usd, usd0, tcgUrl, pcUrl, esc, langBadge, initChrome,
         dataError, getGot, setGot, wishKey, eeveeRank, byText, PLACEHOLDER,
         needImg, normNum } from './data.js';

initChrome('wishlist.html');
const el = (id) => document.getElementById(id);

const state = { sort: 'set', max: null, src: 'all', group: true, hideGot: false, view: 'list' };
let items = [], got = getGot(), needMap = {};

(async function main() {
  const d = await loadAll();
  el('err').innerHTML = dataError(d._err);
  const px = priceIndex(d.prices, d.sets);
  needMap = d['need-images'] || {};

  // Source 1: missing slots in tracked sets.
  const fromSets = (d.sets || []).flatMap((s) =>
    (s.slots || []).filter((x) => x.card_id == null).map((x) => ({
      name: x.name, number: x.number, set: s.name, setKey: s.key,
      imgKey: `${s.key}|${normNum(x.number)}`,
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

  items = [...fromSets, ...standalone].map((i) => ({ ...i, key: wishKey(i) }));

  el('fSort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  el('fSrc').addEventListener('change', (e) => { state.src = e.target.value; render(); });
  el('fMax').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    state.max = isNaN(v) ? null : v;
    el('maxOut').textContent = state.max == null ? 'no limit' : usd0(state.max);
    render();
  });
  el('vList').addEventListener('click', () => setView('list'));
  el('vCards').addEventListener('click', () => setView('cards'));
  el('fGroup').addEventListener('click', () => {
    state.group = !state.group;
    el('fGroup').setAttribute('aria-pressed', state.group);
    render();
  });
  el('fHide').addEventListener('click', () => {
    state.hideGot = !state.hideGot;
    el('fHide').setAttribute('aria-pressed', state.hideGot);
    render();
  });

  // Keep tabs in sync.
  addEventListener('storage', (e) => { if (e.key === 'ptcg-got') { got = getGot(); render(); } });
  render();
})();

function setView(v) {
  state.view = v;
  el('vList').setAttribute('aria-pressed', v === 'list');
  el('vCards').setAttribute('aria-pressed', v === 'cards');
  render();
}

function filtered() {
  return items.filter((i) => {
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

function cardTile(i) {
  const isGot = got.has(i.key);
  return `<article class="card wl-card${isGot ? ' got' : ''}">
    <div class="pocket">${needImg(needMap, i.imgKey, `${i.name} ${i.number}`)}
      ${isGot ? '<span class="need-chip got-chip">GOT</span>' : '<span class="need-chip">NEED</span>'}</div>
    <div class="card-b">
      <div class="card-n">${esc(i.name)} ${langBadge(i.lang)}</div>
      <div class="card-m">${esc(i.number)}</div>
      <div class="card-s">${esc(i.set)}</div>
      <div class="card-p${typeof i.price === 'number' ? '' : ' none'}">${typeof i.price === 'number' ? usd(i.price) : 'no price'}</div>
      <div class="card-lnks">
        <a href="${tcgUrl(i.search_string)}" target="_blank" rel="noopener">TCG</a>
        <button class="btn${isGot ? ' on' : ''}" data-got="${esc(i.key)}">${isGot ? '✓' : 'Got it'}</button>
      </div>
    </div></article>`;
}

function row(i) {
  const isGot = got.has(i.key);
  return `<div class="wl-row${isGot ? ' got' : ''}">
    <div class="wl-img">${needImg(needMap, i.imgKey, `${i.name} ${i.number}`)}</div>
    <div class="wl-main">
      <div class="wl-n">${esc(i.name)} ${langBadge(i.lang)}
        ${i.src === 'set' ? '<span class="tag">set slot</span>' : ''}</div>
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
  const priced = rows.filter((r) => typeof r.price === 'number');
  const tot = priced.reduce((s, r) => s + r.price, 0);
  const openRows = rows.filter((r) => !got.has(r.key));
  const openTot = openRows.filter(r => typeof r.price === 'number').reduce((s, r) => s + r.price, 0);

  el('stats').innerHTML = `
    <div class="stat"><div class="stat-k">Cards wanted</div><div class="stat-v">${openRows.length}</div></div>
    <div class="stat"><div class="stat-k">Est. total cost</div><div class="stat-v big">${priced.length ? usd0(openTot) : '—'}</div></div>
    <div class="stat"><div class="stat-k">Marked got</div><div class="stat-v">${rows.length - openRows.length}</div></div>
    <div class="stat"><div class="stat-k">Priced</div><div class="stat-v">${priced.length}<span style="font-size:14px;color:var(--fg-faint)"> / ${rows.length}</span></div></div>`;

  el('count').textContent = `${rows.length} item${rows.length === 1 ? '' : 's'}` +
    (priced.length < rows.length ? ` · ${rows.length - priced.length} without a price` : '');

  if (!rows.length) {
    el('out').innerHTML = `<div class="empty-st"><h3>Nothing on the list</h3>
      <p>Either every slot is filled or the filters are hiding things. Say
      <strong>“add to wishlist”</strong> in Claude Code to add a card you want.</p></div>`;
  } else if (state.group && state.sort === 'set') {
    const groups = new Map();
    for (const i of sortRows(rows)) {
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
      ? `<div class="grid">${sortRows(rows).map(cardTile).join('')}</div>`
      : sortRows(rows).map(row).join('');
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
