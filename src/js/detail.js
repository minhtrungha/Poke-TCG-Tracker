/* Card detail sheet — one shared <dialog> for every page.
   Pages hand it a list of items plus the index that was clicked; ‹ › and the
   arrow keys step through that same list. Native <dialog> gives focus
   trapping, Esc to close and the modal backdrop for free. */
import { esc, usd, langBadge, tcgUrl, pcUrl, PLACEHOLDER } from './data.js';

let dlg, list = [], at = 0, opener = null;
/* History: opening the sheet from a click pushes one entry (#card=<id>) so
   the phone/browser Back button closes the sheet instead of leaving the page.
   `pushed` records whether WE added that entry; closing then goes back over it.
   A sheet opened from a deep link on load pushed nothing, so closing it just
   strips the hash with replaceState. ‹ › always replaceState (no pile-up). */
let pushed = false, closingFromPop = false;
const getters = [];   // every bindDetails() list on the page (Portfolio has two)
const HASH = 'card=';
const hashId = () => {
  let h = '';
  try { h = decodeURIComponent(location.hash.slice(1)); } catch (_) { return null; }   // e.g. #card=%E0
  return h.startsWith(HASH) ? h.slice(HASH.length) : null;
};
const urlFor = (id) => `${location.pathname}${location.search}#${HASH}${encodeURIComponent(id)}`;
const urlBare = () => `${location.pathname}${location.search}`;

function ensure() {
  if (dlg) return dlg;
  dlg = document.createElement('dialog');
  dlg.className = 'dt';
  dlg.setAttribute('aria-labelledby', 'dt-title');
  document.body.appendChild(dlg);
  // click on the backdrop (the dialog box itself, outside .dt-in) closes it
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close();
    const nav = e.target.closest('[data-dt]');
    if (nav) {
      if (nav.dataset.dt === 'x') close();
      if (nav.dataset.dt === 'prev') step(-1);
      if (nav.dataset.dt === 'next') step(1);
    }
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });
  // Every way of closing (×, backdrop, Esc via the native cancel) ends here.
  dlg.addEventListener('close', () => {
    document.documentElement.classList.remove('dt-open');
    if (!closingFromPop) {
      if (pushed && hashId()) history.back();               // drop the entry we added
      else if (hashId()) history.replaceState(history.state, '', urlBare());
    }
    pushed = false; closingFromPop = false;
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  });
  bindSwipe(dlg);
  return dlg;
}

/* Swipe ← → steps; a downward swipe from the top of the sheet closes it on
   phones. touch-action:pan-y keeps vertical scrolling native. */
function bindSwipe(d) {
  let x0 = 0, y0 = 0, t0 = 0, top0 = 0, tracking = false;
  d.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { tracking = false; return; }
    const t = e.touches[0];
    x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); tracking = true;
    const inn = d.querySelector('.dt-in');
    top0 = inn ? inn.scrollTop : 0;
  }, { passive: true });
  d.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0;
    if (Date.now() - t0 > 900) return;                        // a slow drag is not a swipe
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { step(dx < 0 ? 1 : -1); return; }
    if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5 && top0 <= 0 && matchMedia('(max-width: 640px)').matches) close();
  }, { passive: true });
  d.addEventListener('touchcancel', () => { tracking = false; }, { passive: true });
}

function step(d) {
  if (list.length < 2) return;
  at = (at + d + list.length) % list.length;
  // Repainting replaces the focused control; put focus back on its twin so
  // arrow keys and screen readers stay inside the sheet.
  const was = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.dt;
  paint(d);
  if (list[at] && list[at].id) history.replaceState(history.state, '', urlFor(list[at].id));
  (dlg.querySelector(`[data-dt="${was || 'x'}"]`) || dlg.querySelector('.dt-x')).focus({ preventScroll: true });
}
function close() { if (dlg && dlg.open) dlg.close(); }

/* Back/Forward: the hash decides whether the sheet is open. */
addEventListener('popstate', () => {
  const id = hashId();
  if (!id && dlg && dlg.open) { closingFromPop = true; pushed = false; dlg.close(); return; }
  if (id && (!dlg || !dlg.open)) {
    for (const g of getters) {
      let items = [];
      try { items = g() || []; } catch (_) {}
      const i = items.findIndex((x) => x && x.id === id);
      if (i >= 0) { show(items, i, null); pushed = true; break; }   // Forward re-opened it; Back closes again
    }
  }
});
// A page restored from the back/forward cache keeps its DOM; make the sheet
// agree with the URL it came back to.
addEventListener('pageshow', (e) => {
  if (!e.persisted || !dlg) return;
  if (dlg.open && !hashId()) { closingFromPop = true; dlg.close(); }
});

const fact = ([k, v]) => (v == null || v === '' ? '' : `<dt>${esc(k)}</dt><dd>${v}</dd>`);

function paint(dir = 0) {
  const it = list[at];
  const art = it.img
    ? `<img src="${esc(it.img)}" alt="${esc(it.title)}${it.number ? ' ' + esc(it.number) : ''}" decoding="async">`
    : PLACEHOLDER;
  const status = {
    owned: '<span class="dt-chip own">Owned</span>',
    need: '<span class="dt-chip need">Need</span>',
    got: '<span class="dt-chip got">Got it (local note)</span>',
    sealed: `<span class="dt-chip own">Sealed${it.qty ? ` · ×${esc(String(it.qty))}` : ''}</span>`,
  }[it.kind] || '';
  // Optional { delta, pct, since }: change since the previous price sync.
  const pc = it.priceChange;
  const chg = pc && typeof pc.delta === 'number'
    ? (() => {
        const dir = pc.delta > 0 ? 'up' : pc.delta < 0 ? 'down' : 'flat';
        const arrow = { up: '▲', down: '▼', flat: '■' }[dir];
        const pct = typeof pc.pct === 'number' ? ` (${pc.pct > 0 ? '+' : ''}${pc.pct.toFixed(1)}%)` : '';
        const words = { up: 'up', down: 'down', flat: 'no change' }[dir];
        return `<span class="dt-chg ${dir}"><span aria-hidden="true">${arrow}</span> ${dir === 'flat' ? '' : usd(Math.abs(pc.delta))}${dir === 'flat' ? 'No change' : pct}${pc.since ? ` since ${esc(pc.since)}` : ''}<span class="vh"> (${words})</span></span>`;
      })()
    : '';
  const price = typeof it.price === 'number'
    ? `<div class="dt-price"><b>${usd(it.price)}</b>${chg}${it.priceNote ? `<span>${esc(it.priceNote)}</span>` : ''}</div>`
    : `<div class="dt-price none"><b>No price</b><span>${esc(it.priceNote || 'Not found in the TCGplayer feed')}</span></div>`;
  const links = (it.links || []).map((l) =>
    `<a class="btn dt-link" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}<span aria-hidden="true"> ↗</span></a>`).join('');
  const nav = list.length > 1
    ? `<div class="dt-nav">
        <button type="button" class="btn" data-dt="prev" aria-label="Previous card">‹</button>
        <span class="dt-pos">${at + 1} / ${list.length}</span>
        <button type="button" class="btn" data-dt="next" aria-label="Next card">›</button></div>` : '';

  dlg.innerHTML = `<div class="dt-in${dir ? (dir > 0 ? ' fwd' : ' back') : ''}${it.kind === 'sealed' ? ' wide-art' : ''}">
    <button type="button" class="dt-x" data-dt="x" aria-label="Close">×</button>
    <div class="dt-art${it.kind === 'need' ? ' is-need' : ''}">${art}</div>
    <div class="dt-body">
      <div class="dt-top">${it.sprite ? `<img class="dt-sprite" src="images/sprites/${esc(it.sprite)}" alt="" aria-hidden="true">` : ''}${status}</div>
      <h2 id="dt-title">${esc(it.title)} ${it.lang ? langBadge(it.lang) : ''}</h2>
      ${it.subtitle ? `<p class="dt-sub">${esc(it.subtitle)}</p>` : ''}
      ${price}
      <dl class="dt-facts">${(it.facts || []).map(fact).join('')}</dl>
      <div class="dt-links">${links}</div>
      ${nav}
    </div></div>`;
  // A missing or broken image falls back to the Pokéball placeholder.
  const img = dlg.querySelector('.dt-art img');
  if (img) img.addEventListener('error', () => { img.outerHTML = PLACEHOLDER; }, { once: true });
}

function show(items, i, from) {
  ensure();
  list = items; at = i; opener = from || document.activeElement;
  paint();
  document.documentElement.classList.add('dt-open');
  if (!dlg.open) dlg.showModal();
  dlg.querySelector('.dt-x').focus({ preventScroll: true });
}

/* items: array of detail objects; i: index clicked; from: element to refocus.
   Items with an `id` get a linkable URL (#card=<id>) and Back closes them. */
export function openDetail(items, i, from) {
  const wasOpen = !!(dlg && dlg.open);
  show(items, i, from);
  const id = items[i] && items[i].id;
  if (!id) return;
  if (wasOpen || hashId() === id) {
    history.replaceState(history.state, '', urlFor(id));
  } else {
    history.pushState({ dt: id }, '', urlFor(id));
    pushed = true;
  }
}

/* Wire a container: any click inside an element carrying data-i opens the
   sheet, unless the click was on a real link or button of its own.
   If the page was opened with #card=<id>, that item opens once the page has
   rendered its list (getItems() contains it); gives up after ~3 s. */
export function bindDetails(container, getItems) {
  getters.push(getItems);
  container.addEventListener('click', (e) => {
    const hit = e.target.closest('[data-i]');
    if (!hit || !container.contains(hit)) return;
    const own = e.target.closest('a[href], button:not([data-open]), input, select, label');
    if (own && own !== hit) return;
    e.preventDefault();
    openDetail(getItems(), +hit.dataset.i, hit.querySelector('[data-open]') || hit);
  });
  const want = hashId();
  if (!want) return;
  const t0 = Date.now();
  (function poll() {
    let items = [];
    try { items = getItems() || []; } catch (_) {}
    const i = items.findIndex((x) => x && x.id === want);
    if (i >= 0) {
      if (!(dlg && dlg.open)) {
        show(items, i, container.querySelector(`[data-i="${i}"] [data-open]`) || container.querySelector(`[data-i="${i}"]`));
        pushed = false;               // the entry was already in history; closing just strips the hash
      }
      return;
    }
    if (Date.now() - t0 < 3000) setTimeout(poll, 100);
  })();
}

/* ---- builders: turn page records into detail objects ---- */
/* Stable ids so a sheet can be linked (#card=<id>) and survive re-sorting. */
const slug = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const tags = (t) => (t && t.length ? t.map((x) => `<span class="tag">${esc(x)}</span>`).join(' ') : '');

export function ownedDetail(c, { price, checked, sprites } = {}) {
  return {
    id: `c${c.id}`,
    kind: 'owned',
    title: c.name, number: c.number, lang: c.lang || 'EN',
    subtitle: `${c.number} · ${c.set}`,
    img: c.image ? `images/cards/${c.image}` : null,
    sprite: sprites && sprites[c.name],
    price,
    priceNote: typeof price === 'number' ? `TCGplayer market${checked ? ` · checked ${checked}` : ''}` : null,
    facts: [
      ['Set', esc(c.set)],
      ['Number', esc(c.number)],
      ['Rarity', esc(c.rarity || '')],
      ['Printing', esc(c.printing || '')],
      ['Condition', esc(c.condition || '')],
      ['Binder page', esc(c.binder_page || '')],
      ['Tags', tags(c.tags)],
      ['Note', c.warn ? `⚠ ${esc(c.warn)}` : ''],
    ],
    links: [
      { label: 'TCGplayer', href: tcgUrl(c.search_string || `${c.name} ${c.number}`) },
      { label: 'PriceCharting', href: pcUrl(c.name, c.number) },
    ],
  };
}

export function needDetail(i, { img, checked, sprites, got } = {}) {
  return {
    id: `n-${slug(i.lang || 'EN')}-${slug(i.setKey || i.set)}-${slug(i.number)}-${slug(i.name)}`,
    kind: got ? 'got' : 'need',
    title: i.name, number: i.number, lang: i.lang || 'EN',
    subtitle: `${i.number} · ${i.set}`,
    img: img || null,
    sprite: sprites && sprites[i.name],
    price: i.price,
    priceNote: typeof i.price === 'number' ? `TCGplayer market${checked ? ` · checked ${checked}` : ''}` : null,
    facts: [
      ['Set', esc(i.set)],
      ['Number', esc(i.number)],
      ['Rarity', esc(i.rarity || '')],
      ['Illustrator', esc(i.illustrator || '')],
      ['On the list as', i.src === 'set' ? 'Missing set slot' : 'Standalone want'],
    ],
    links: [
      { label: 'TCGplayer', href: tcgUrl(i.search_string || `${i.name} ${i.number}`) },
      { label: 'PriceCharting', href: pcUrl(i.name, i.number) },
    ],
  };
}

export function sealedDetail(s) {
  const line = typeof s.price_usd === 'number' ? s.price_usd * (s.qty || 1) : null;
  return {
    id: `s${s.id}`,
    kind: 'sealed', qty: s.qty || 1,
    title: s.name,
    subtitle: s.set || '',
    img: s.image ? `images/sealed/${s.image}` : null,
    price: s.price_usd,
    priceNote: typeof s.price_usd === 'number'
      ? `each · ${s.price_source === 'manual' ? 'entered by hand from TCGplayer' : 'TCGplayer market'}${s.price_checked ? ` · ${s.price_checked}` : ''}`
      : null,
    facts: [
      ['Quantity', String(s.qty || 1)],
      ['Line value', line == null ? '' : usd(line)],
      ['Set', esc(s.set || '')],
      ['Price note', s.price_note ? esc(s.price_note) : ''],
    ],
    links: [
      { label: 'TCGplayer', href: s.tcgplayer_id ? `https://www.tcgplayer.com/product/${s.tcgplayer_id}` : tcgUrl(s.search_string || s.name) },
      { label: 'PriceCharting', href: `https://www.pricecharting.com/search-products?type=pokemon&q=${encodeURIComponent(s.search_string || s.name)}` },
    ],
  };
}
