import { loadAll, priceIndex, usd, usd0, tcgUrl, esc, initChrome, initOffline, dataError, byText,
         gameIndex, gameOf, gameBadge } from './data.js';
import { bindDetails, sealedDetail } from './detail.js';

initOffline();
initChrome('sealed.html');
const el = (id) => document.getElementById(id);
let items = [], shownRows = [], cardsTotal = null, gi = null, gamesPresent = [];
const SORTS = ['value', 'unit', 'qty', 'name'];
const SORT_KEY = 'ptcg-sealed-sort';
const GAME_KEY = 'ptcg-sealed-game';
const state = { sort: 'value', game: 'all' };

function loadState() {
  const q = new URLSearchParams(location.search);
  const u = q.get('sort');
  let saved = null, savedGame = null;
  try { saved = localStorage.getItem(SORT_KEY); savedGame = localStorage.getItem(GAME_KEY); } catch (_) {}
  state.sort = SORTS.includes(u) ? u : SORTS.includes(saved) ? saved : 'value';
  // The game filter is validated against what is actually held, not just
  // against the registry: a stored game the owner no longer has anything from
  // would otherwise show an empty page with no obvious cause.
  const ok = (g) => g === 'all' || gamesPresent.some((x) => x.key === g);
  const ug = q.get('game');
  state.game = ok(ug) ? ug : ok(savedGame) ? savedGame : 'all';
  // A state restored from storage is also written to the URL, like the Cards
  // page, so the address always describes what is on screen.
  if (u !== state.sort || ug !== state.game) saveState();
}
function saveState() {
  try {
    localStorage.setItem(SORT_KEY, state.sort);
    localStorage.setItem(GAME_KEY, state.game);
  } catch (_) {}
  const q = new URLSearchParams();
  if (state.sort !== 'value') q.set('sort', state.sort);
  if (state.game !== 'all') q.set('game', state.game);
  const qs = q.toString();
  try { history.replaceState(history.state, '', location.pathname + (qs ? `?${qs}` : '') + location.hash); } catch (_) {}
}

(async function main() {
  const d = await loadAll();
  el('err').innerHTML = dataError(d._err);
  gi = gameIndex(d.games);
  items = (d.sealed || []).map((s) => ({
    ...s,
    qty: s.qty || 1,
    game: gameOf(s),
    line: typeof s.price_usd === 'number' ? s.price_usd * (s.qty || 1) : null,
  }));
  gamesPresent = gi.present(items);
  loadState();

  // Card value, priced exactly as the Portfolio does, so the share adds up there too.
  const px = priceIndex(d.prices, d.sets);
  const vals = (d.cards || []).map((c) => px.get(c)).filter((p) => typeof p === 'number');
  cardsTotal = vals.length ? vals.reduce((a, b) => a + b, 0) : null;

  if (!items.length) {
    el('out').innerHTML = `<div class="empty-st"><h3>No sealed product tracked</h3>
      <p>Add entries to <code>data/sealed.json</code> with a name, set, game and quantity,
      then run <code>npm run prices:write</code> to price them.</p></div>`;
    el('stats').innerHTML = '';
    return;
  }
  bindDetails(el('out'), () => shownRows.map((s) => sealedDetail(s, gi)));
  el('fSort').value = state.sort;
  el('fSort').addEventListener('change', (e) => { state.sort = e.target.value; saveState(); render(); });

  // The game filter only appears once there is more than one game to choose
  // between, so a single-game collection keeps the bar it had.
  const fg = el('fGameFld');
  if (gamesPresent.length > 1) {
    el('fGame').innerHTML = `<option value="all">All games</option>` +
      gamesPresent.map((g) => `<option value="${esc(g.key)}">${esc(g.name)}</option>`).join('');
    el('fGame').value = state.game;
    el('fGame').addEventListener('change', (e) => { state.game = e.target.value; saveState(); render(); });
  } else {
    fg.hidden = true;
    state.game = 'all';
  }
  render();
})();

/* Value per game, over every product regardless of the current filter: this
   strip is the overview the filter narrows, so it must not narrow with it. */
function renderGames(grandTotal) {
  const box = el('gsplit');
  if (gamesPresent.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = gamesPresent.map((g) => {
    const mine = items.filter((s) => s.game === g.key);
    const val = mine.reduce((t, s) => t + (s.line || 0), 0);
    const units = mine.reduce((t, s) => t + s.qty, 0);
    const unpriced = mine.filter((s) => s.line == null).length;
    const pct = grandTotal ? (val / grandTotal) * 100 : 0;
    return `<div class="gsplit-i" data-game="${esc(g.key)}">
      <div class="gsplit-top">${gameBadge(gi, g.key, { full: true })}
        <span class="gsplit-v">${usd0(val)}</span></div>
      <div class="gsplit-bar" role="img" aria-label="${esc(g.name)} is ${Math.round(pct)}% of sealed value">
        <i style="width:${pct.toFixed(1)}%"></i></div>
      <div class="gsplit-s">${units} unit${units === 1 ? '' : 's'} · ${mine.length} product${mine.length === 1 ? '' : 's'}${unpriced ? ` · ${unpriced} unpriced` : ''}</div>
    </div>`;
  }).join('');
}

function render() {
  const inGame = items.filter((s) => state.game === 'all' || s.game === state.game);
  const rows = inGame.slice().sort({
    value: (a, b) => (b.line ?? -1) - (a.line ?? -1) || byText(a.name, b.name),
    unit: (a, b) => (b.price_usd ?? -1) - (a.price_usd ?? -1) || byText(a.name, b.name),
    qty: (a, b) => b.qty - a.qty || (b.line ?? -1) - (a.line ?? -1),
    name: (a, b) => byText(a.name, b.name),
  }[state.sort]);

  shownRows = rows;
  const priced = rows.filter((r) => typeof r.line === 'number');
  const total = priced.reduce((s, r) => s + r.line, 0);
  const units = rows.reduce((s, r) => s + r.qty, 0);
  const allTotal = items.reduce((t, s) => t + (s.line || 0), 0);
  const holdings = cardsTotal == null ? null : cardsTotal + allTotal;
  const share = holdings ? total / holdings : null;
  const filtered = state.game !== 'all';
  const gName = filtered ? gi.name(state.game) : null;

  renderGames(allTotal);

  el('stats').innerHTML = `
    <div class="stat"><div class="stat-k">${filtered ? `${esc(gName)} sealed` : 'Sealed value'}</div>
      <div class="stat-v big">${usd0(total)}</div>${filtered
        ? `<span class="stat-sub">of ${usd0(allTotal)} all games</span>` : ''}</div>
    ${share != null ? `<div class="stat sl-share"><div class="stat-k">Share of holdings</div>
      <div class="stat-v">${Math.round(share * 100)}%</div>
      <div class="sl-share-bar" role="img" aria-label="${filtered ? esc(gName) + ' sealed is' : 'Sealed is'} ${Math.round(share * 100)}% of ${usd0(holdings)} total holdings">
        <i style="width:${(share * 100).toFixed(1)}%"></i></div>
      <span class="stat-sub">of ${usd0(holdings)} cards + sealed</span></div>` : ''}
    <div class="stat"><div class="stat-k">Products</div><div class="stat-v">${rows.length}<span class="stat-sub">${units} units</span></div></div>
    ${priced.length < rows.length
      ? `<div class="stat"><div class="stat-k">Unpriced</div><div class="stat-v">${rows.length - priced.length}</div></div>` : ''}`;

  const on = (k) => (state.sort === k ? ' on' : '');
  el('head').innerHTML = `<span class="sl-h-name${on('name')}">Product${state.sort === 'qty' ? ' · by quantity' : ''}</span>
    <span class="sl-h-unit${on('unit')}">Each</span><span class="sl-h-line${on('value')}">Line value</span>`;

  if (!rows.length) {
    el('out').innerHTML = `<div class="empty-st"><h3>Nothing sealed for ${esc(gName || 'this game')}</h3>
      <p>Pick another game, or add entries to <code>data/sealed.json</code>.</p></div>`;
    return;
  }

  const maxLine = Math.max(0, ...priced.map((r) => r.line));
  el('out').innerHTML = rows.map((s, i) => `<div class="sealed-row" data-i="${i}">
      <button type="button" class="card-hit" data-open aria-label="Details for ${esc(s.name)}"></button>
      <div class="sealed-img">${s.image
        ? `<img src="images/sealed/${esc(s.image)}" alt="" loading="lazy" decoding="async">`
        : ''}</div>
      <div class="sealed-qty" title="quantity owned">×${esc(String(s.qty))}</div>
      <div class="sealed-main">
        <div class="sealed-n">${esc(s.name)}</div>
        <div class="sealed-s">${gamesPresent.length > 1 ? gameBadge(gi, s.game) + ' ' : ''}${esc(s.set || '')}${s.price_source === 'manual' ? ' · <span class="sl-manual">price entered by hand</span>' : ''}</div>
        ${typeof s.line === 'number' && total ? `<div class="sl-bar" aria-hidden="true"><i style="width:${(s.line / maxLine * 100).toFixed(1)}%"></i></div>
          <div class="sl-pct">${Math.round(s.line / total * 100)}% of ${filtered ? esc(gName) : 'sealed'}</div>` : ''}
      </div>
      <div class="sealed-unit${on('unit')}">${typeof s.price_usd === 'number' ? usd(s.price_usd) + ' ea' : '<span class="muted">no price</span>'}</div>
      <div class="sealed-line${on('value')}">${typeof s.line === 'number' ? usd(s.line) : '—'}</div>
      <a class="btn" href="${s.tcgplayer_id ? `https://www.tcgplayer.com/product/${encodeURIComponent(s.tcgplayer_id)}` : tcgUrl(s.search_string || s.name, s.game)}" target="_blank" rel="noopener">TCG</a>
    </div>`).join('');
}
