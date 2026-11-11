import { loadAll, priceIndex, usd0, tcgUrl, pcUrl, imgTag, esc, langBadge,
         initChrome, dataError, PLACEHOLDER } from './data.js';

initChrome('sets.html');
const el = (id) => document.getElementById(id);
const state = { lang: 'all', only: 'all' };
let sets = [], byId = new Map(), px = null;

(async function main() {
  const d = await loadAll();
  el('err').innerHTML = dataError(d._err);
  px = priceIndex(d.prices, d.sets);
  byId = new Map(d.cards.map((c) => [c.id, c]));
  sets = d.sets || [];

  el('fLang').addEventListener('change', (e) => { state.lang = e.target.value; render(); });
  el('fOnly').addEventListener('change', (e) => { state.only = e.target.value; render(); });
  render();
})();

function render() {
  const shown = sets.filter((s) => state.lang === 'all' || (s.lang || 'EN') === state.lang);

  const slots = shown.flatMap((s) => s.slots || []);
  const filled = slots.filter((x) => x.card_id != null).length;
  const missCost = shown.flatMap((s) => (s.slots || [])
      .filter((x) => x.card_id == null)
      .map((x) => px.getSlot(s.key, x.number)))
    .filter((p) => typeof p === 'number').reduce((a, b) => a + b, 0);

  el('stats').innerHTML = `
    <div class="stat"><div class="stat-k">Sets tracked</div><div class="stat-v">${shown.length}</div></div>
    <div class="stat"><div class="stat-k">Slots filled</div><div class="stat-v big">${filled}<span style="font-size:14px;color:var(--fg-faint)"> / ${slots.length}</span></div></div>
    <div class="stat"><div class="stat-k">Complete sets</div><div class="stat-v">${shown.filter(s=>(s.slots||[]).every(x=>x.card_id!=null)).length}</div></div>
    ${missCost > 0 ? `<div class="stat"><div class="stat-k">Cost to finish</div><div class="stat-v">${usd0(missCost)}</div></div>` : ''}`;

  el('out').innerHTML = shown.map((s) => {
    let sl = s.slots || [];
    const total = sl.length;
    const have = sl.filter((x) => x.card_id != null).length;
    if (state.only === 'missing') sl = sl.filter((x) => x.card_id == null);
    if (state.only === 'owned') sl = sl.filter((x) => x.card_id != null);
    const pct = total ? Math.round((have / total) * 100) : 0;
    const done = have === total && total > 0;

    const pockets = sl.map((slot) => {
      const card = slot.card_id != null ? byId.get(slot.card_id) : null;
      if (card) {
        // Owned pocket -> PriceCharting
        return `<a class="pk" href="${pcUrl(card.name, card.number)}" target="_blank" rel="noopener"
                   title="${esc(card.name)} ${esc(card.number)} — open PriceCharting">
          <div class="pk-img">${imgTag(card, { thumb: true })}</div>
          <div class="pk-b"><div class="pk-n">${esc(card.name)}</div>
            <div class="pk-num">${esc(slot.number)}</div></div></a>`;
      }
      // Missing pocket -> TCGplayer search
      const p = px.getSlot(s.key, slot.number);
      return `<a class="pk miss" href="${tcgUrl(`${slot.name} ${slot.number}`)}" target="_blank" rel="noopener"
                 title="${esc(slot.name)} ${esc(slot.number)} — search TCGplayer">
        <div class="pk-img"><span class="miss-x">+</span></div>
        <div class="pk-b"><div class="pk-n">${esc(slot.name)}</div>
          <div class="pk-num">${esc(slot.number)}</div>
          ${typeof p === 'number' ? `<div class="pk-pr">${usd0(p)}</div>` : ''}</div></a>`;
    }).join('');

    return `<section class="set">
      <div class="set-h"><span class="set-t">${esc(s.name)}</span>${langBadge(s.lang)}
        <span class="set-ct${done ? ' done' : ''}">${have} / ${total}${done ? ' ✓' : ''}</span></div>
      ${s.note ? `<p class="set-note">${esc(s.note)}</p>` : ''}
      <div class="pbar"><i class="${done ? 'done' : ''}" style="width:${pct}%"></i></div>
      ${sl.length ? `<div class="pockets">${pockets}</div>`
        : `<p class="set-note" style="margin:0">Nothing to show with this filter.</p>`}
    </section>`;
  }).join('');
}
