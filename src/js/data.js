/* Shared data layer: loads the four JSON files and exposes helpers. */
export const PLACEHOLDER = `<span class="ph" aria-label="Not owned yet"><svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <rect x="2" y="2" width="96" height="136" rx="6" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="2.5" stroke-dasharray="7 5"/>
  <g transform="translate(50 58)" opacity=".5">
    <circle r="20" fill="none" stroke="currentColor" stroke-width="3.2"/>
    <path d="M-20 0a20 20 0 0 1 40 0z" fill="currentColor" fill-opacity=".22"/>
    <line x1="-20" y1="0" x2="20" y2="0" stroke="currentColor" stroke-width="3.2"/>
    <circle r="6.2" fill="none" stroke="currentColor" stroke-width="3.2"/>
  </g>
  <text x="50" y="100" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="10.5" font-weight="800" fill="currentColor" fill-opacity=".7" letter-spacing="1.2">NOT YET</text>
</svg></span>`;

const FILES = ['cards', 'sets', 'prices', 'wishlist', 'need-images', 'sealed', 'sprites'];

export async function loadAll() {
  const out = {};
  await Promise.all(FILES.map(async (f) => {
    try {
      const r = await fetch(`data/${f}.json`, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      out[f] = await r.json();
    } catch (e) {
      console.error(`Could not load data/${f}.json:`, e);
      out[f] = (f === 'prices' || f === 'need-images' || f === 'sprites') ? {} : [];
      out._err = out._err || [];
      out._err.push(f);
    }
  }));
  return out;
}

/* --- prices --- */
/* prices.json: { checked_date, sources, <set_key>: { <number>: usd } }
   Cards carry a set NAME, not a set key, so we resolve via sets.json where
   possible and fall back to scanning every price bucket for the card number. */
export function priceIndex(prices, sets) {
  const byKeyNum = new Map();
  const META = new Set(['checked_date', 'sources', '_note']);
  for (const [k, v] of Object.entries(prices || {})) {
    if (META.has(k) || typeof v !== 'object' || v === null) continue;
    for (const [num, p] of Object.entries(v)) {
      if (typeof p === 'number') byKeyNum.set(`${k}|${normNum(num)}`, p);
    }
  }
  // set NAME -> key, so a card that stores only a display name can still resolve.
  const nameToKey = new Map();
  for (const s of sets || []) nameToKey.set(s.name, s.key);

  /* A price is only used when we can tie it to a specific set bucket. Card
     numbers repeat across sets (and across printings of one card, e.g. the
     stamped vs plain Umbreon ex 060/131), so guessing by number alone would
     assign one card's value to another. Unmatched cards report null instead. */
  function forCard(card) {
    if (!card) return null;
    const n = normNum(card.number);
    const key = card.set_key || nameToKey.get(card.set);
    if (key && byKeyNum.has(`${key}|${n}`)) return byKeyNum.get(`${key}|${n}`);
    return null;
  }
  return {
    byKeyNum, nameToKey,
    get: forCard,
    getSlot(setKey, number) {
      const v = byKeyNum.get(`${setKey}|${normNum(number)}`);
      return v === undefined ? null : v;
    },
    get isEmpty() { return byKeyNum.size === 0; },
  };
}

export function normNum(n) {
  return String(n == null ? '' : n).trim().toUpperCase().replace(/\s+/g, ' ');
}

/* --- formatting --- */
export const usd = (n) => n == null ? '—'
  : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd0 = (n) => n == null ? '—'
  : '$' + Math.round(n).toLocaleString('en-US');

export function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
export function daysSince(s) {
  const d = parseDate(s);
  return d == null ? null : Math.floor((Date.now() - d.getTime()) / 86400000);
}

/* --- links --- */
export const tcgUrl = (q) =>
  `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(q)}`;
export const pcUrl = (name, number) =>
  `https://www.pricecharting.com/search-products?type=pokemon&q=${encodeURIComponent(`${name} ${number}`.trim())}`;

/* --- images --- */
export function imgTag(card, { thumb = false, lazy = true } = {}) {
  if (!card || !card.image) return PLACEHOLDER;
  const dir = thumb ? 'images/thumbs' : 'images/cards';
  const alt = esc(`${card.name} ${card.number}`);
  return `<img src="${dir}/${esc(card.image)}" alt="${alt}"${lazy ? ' loading="lazy" decoding="async"' : ''}>`;
}

/* Art for a card the owner does NOT own yet, from images/need/.
   Falls back to the Pokeball placeholder when no product image was found. */
export function needImg(map, key, label) {
  const f = map && map[key];
  if (!f) return PLACEHOLDER;
  return `<img class="need-art" src="images/need/${esc(f)}" alt="${esc(label || '')}" loading="lazy" decoding="async">`;
}

/* Decorative species sprite for a card name. Purely ornamental: it never
   replaces a card photo or NEED art, so it is always alt="" and aria-hidden.
   Returns '' when the species has no sprite (Gen 9 is not in the set). */
export function sprite(map, name, cls = 'sprite') {
  const f = map && map[name];
  if (!f) return '';
  return `<img class="${cls}" src="images/sprites/${esc(f)}" alt="" aria-hidden="true"
    loading="lazy" decoding="async" width="40" height="30">`;
}

/* --- misc --- */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
export const langBadge = (l) => `<span class="lang ${l === 'JP' ? 'JP' : 'EN'}">${esc(l || 'EN')}</span>`;
export const byText = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true });

/* Eeveelution display order used by the wishlist groups. */
const EEVEE_ORDER = ['Leafeon', 'Flareon', 'Vaporeon', 'Glaceon', 'Jolteon', 'Espeon', 'Umbreon', 'Eevee', 'Sylveon'];
export function eeveeRank(name) {
  const i = EEVEE_ORDER.findIndex((e) => String(name).toLowerCase().startsWith(e.toLowerCase()));
  return i === -1 ? 99 : i;
}

/* --- theme + nav (shared chrome) --- */
export function initChrome(active) {
  const KEY = 'ptcg-theme';
  const sysDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (_) {}
  document.documentElement.dataset.theme =
    (saved === 'light' || saved === 'dark') ? saved : (sysDark() ? 'dark' : 'light');

  const pages = [
    ['index.html', 'Portfolio', 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z'],
    ['cards.html', 'Cards',     'M3 5h18v14H3zM3 9h18'],
    ['sealed.html', 'Sealed',   'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10'],
    ['sets.html', 'Sets',       'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'],
    ['wishlist.html', 'Wishlist','M12 21s-7-4.6-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.4-7 10-7 10z'],
  ];
  const icon = (d) => `<svg class="tab-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

  const nav = document.createElement('header');
  nav.className = 'nav';
  nav.innerHTML =
    `<a class="brand" href="index.html">
       <img class="brand-logo" src="img/logo.svg" alt="" width="30" height="30">
       <span class="brand-txt">Poké TCG<span class="brand-sub">Tracker</span></span>
     </a>` +
    `<nav class="tabs" aria-label="Main">` +
    pages.map(([h, l, d]) =>
      `<a class="tab" href="${h}"${h === active ? ' aria-current="page"' : ''}>${icon(d)}<span>${l}</span></a>`).join('') +
    `</nav>` +
    `<button class="theme-btn" id="themeBtn" type="button" aria-label="Switch colour theme">
       <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" aria-hidden="true">
         <circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>
       </svg></button>`;
  document.body.prepend(nav);

  // Mobile bottom bar: same destinations, thumb-reachable.
  const bar = document.createElement('nav');
  bar.className = 'botnav';
  bar.setAttribute('aria-label', 'Main (mobile)');
  bar.innerHTML = pages.map(([h, l, d]) =>
    `<a class="bt" href="${h}"${h === active ? ' aria-current="page"' : ''}>${icon(d)}<span>${l}</span></a>`).join('');
  document.body.appendChild(bar);

  // Credits: sources and copyright, on every page.
  const cr = document.createElement('footer');
  cr.className = 'credits';
  cr.innerHTML = `<p>Card photos are the owner's own. Images for cards not owned are
    TCGplayer product shots via <a href="https://tcgcsv.com" target="_blank" rel="noopener">TCGCSV</a>;
    prices are TCGplayer market estimates, not an appraisal. Species sprites from
    <a href="https://github.com/msikma/pokesprite" target="_blank" rel="noopener">PokéSprite</a>
    (code and data MIT; sprite images © Nintendo / Creatures Inc. / GAME FREAK Inc.).
    Pokémon and all character names are trademarks of Nintendo, Creatures Inc. and
    GAME FREAK Inc. Personal, non-commercial tracker; not affiliated with or endorsed by them.</p>`;
  document.body.appendChild(cr);

  document.getElementById('themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (sysDark() ? 'dark' : 'light');
    const next = cur === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch (_) {}
  });
}

/* Wishlist "Got it" state, shared across tabs via localStorage. */
const GOT_KEY = 'ptcg-got';
export function getGot() {
  try { return new Set(JSON.parse(localStorage.getItem(GOT_KEY) || '[]')); }
  catch (_) { return new Set(); }
}
export function setGot(set) {
  try { localStorage.setItem(GOT_KEY, JSON.stringify([...set])); } catch (_) {}
}
export const wishKey = (w) => `${w.name}|${w.number}|${w.set}`;

/* Register the service worker so the site keeps working offline once loaded.
   Fails silently on file:// or unsupported browsers. */
export function initOffline() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

export function dataError(err) {
  if (!err || !err.length) return '';
  return `<div class="banner stale"><span class="banner-lab">⚠ Could not load ${esc(err.join(', '))}.json</span>
  <span class="banner-note">If you opened this file directly, the browser blocks local fetches — run <code>npm start</code> and use the served URL.</span></div>`;
}
