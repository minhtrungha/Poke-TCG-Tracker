/* Portfolio value over time — one series, so no legend and no categorical palette.
   Pure inline SVG: no chart library, consistent with the rest of the site.

   valueChart(history) returns the markup; bindChart(root) wires the tooltip:
   hovering anywhere over the plot snaps to the nearest point (guide line +
   highlighted dot + tooltip card); touch tap/drag does the same; points are a
   roving-tabindex group, so Tab lands on one and ←/→/Home/End move along. */
import { usd0, usd, esc } from './data.js';

const PAD = { t: 20, r: 18, b: 32, l: 62 };
const W = 720, H = 250;

function points(history) {
  return (history || [])
    .map((p) => ({ ...p, t: new Date(p.date).getTime() }))
    .filter((p) => !isNaN(p.t) && typeof p.total === 'number')
    .sort((a, b) => a.t - b.t);
}

const pctOf = (d, base) => (base ? (d / base) * 100 : 0);
const signed = (d) => `${d >= 0 ? '▲' : '▼'} ${usd(Math.abs(d))}`;

export function valueChart(history, { w = W, h = H } = {}) {
  const pts = points(history);

  if (!pts.length) {
    return `<div class="chart-empty">
      <strong>No price history yet.</strong>
      <span>Each price sync adds a point here, and the line builds up over time.</span>
    </div>`;
  }

  // One reading is not a trend: show it as a readout, not 250px of empty axes.
  if (pts.length === 1) {
    const p = pts[0];
    return `<div class="chart-first">
      <div class="cf-dot" aria-hidden="true"></div>
      <div class="cf-main">
        <div class="cf-k">First reading · ${esc(p.date)}</div>
        <div class="cf-v">${usd(p.total)}</div>
        <div class="cf-s">${p.cards != null ? `${p.cards} cards priced` : ''}${
          p.sealed_total ? ` · ${usd0(p.sealed_total)} sealed` : ''}</div>
      </div>
      <div class="cf-note">The value chart draws a line from the next sync on.</div>
    </div>`;
  }

  const iw = w - PAD.l - PAD.r, ih = h - PAD.t - PAD.b;
  const vals = pts.map((p) => p.total);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo = lo * 0.9 || 0; hi = hi * 1.1 || 1; }
  const padY = (hi - lo) * 0.12; lo = Math.max(0, lo - padY); hi = hi + padY;

  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  const X = (t) => PAD.l + (t1 === t0 ? iw / 2 : ((t - t0) / (t1 - t0)) * iw);
  const Y = (v) => PAD.t + ih - ((v - lo) / (hi - lo)) * ih;

  const ticks = niceTicks(lo, hi, 4);
  const grid = ticks.map((v) =>
    `<line class="c-grid" x1="${PAD.l}" y1="${Y(v).toFixed(1)}" x2="${w - PAD.r}" y2="${Y(v).toFixed(1)}"/>
     <text class="c-ylab" x="${PAD.l - 8}" y="${(Y(v) + 3.5).toFixed(1)}">${usd0(v)}</text>`).join('');

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.total).toFixed(1)}`).join(' ');
  const area = `${line} L${X(t1).toFixed(1)},${(PAD.t + ih).toFixed(1)} L${X(t0).toFixed(1)},${(PAD.t + ih).toFixed(1)} Z`;

  const first = pts[0].total, last = pts[pts.length - 1].total;
  const up = last >= first;

  // data the tooltip reads; rounded to the viewBox so it can be positioned
  const data = pts.map((p, i) => {
    const prev = i ? pts[i - 1] : null;
    return {
      x: +X(p.t).toFixed(1), y: +Y(p.total).toFixed(1), date: p.date, total: p.total,
      cards: p.cards ?? null, cards_total: p.cards_total ?? null, sealed_total: p.sealed_total ?? null,
      d: prev ? p.total - prev.total : null, pct: prev ? pctOf(p.total - prev.total, prev.total) : null,
      since: prev ? prev.date : null,
    };
  });

  const dots = data.map((p, i) => `<g class="c-pt" data-k="${i}" tabindex="${i === data.length - 1 ? 0 : -1}"
      role="img" aria-label="${esc(p.date)}: ${usd(p.total)}${p.d != null ? `, ${p.d >= 0 ? 'up' : 'down'} ${usd(Math.abs(p.d))} since ${esc(p.since)}` : ''}">
      <circle class="c-dot" cx="${p.x}" cy="${p.y}" r="4.5"/>
    </g>`).join('');

  const xlabs = `<text class="c-xlab" x="${PAD.l}" y="${h - 9}" text-anchor="start">${esc(pts[0].date)}</text>
       <text class="c-xlab" x="${(w - PAD.r).toFixed(1)}" y="${h - 9}" text-anchor="end">${esc(pts[pts.length - 1].date)}</text>`;

  const delta = `<span class="c-delta ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${usd0(Math.abs(last - first))}
         (${pctOf(last - first, first).toFixed(1)}%)</span>`;

  return `<figure class="chart" data-w="${w}" data-h="${h}" data-pts='${esc(JSON.stringify(data))}'>
    <figcaption class="chart-head">
      <span class="chart-title">Collection value over time</span>${delta}
      <span class="chart-hint" aria-hidden="true">Hover or tap the line for values</span>
    </figcaption>
    <svg viewBox="0 0 ${w} ${h}" class="chart-svg ${up ? 'up' : 'down'}" role="group"
         aria-label="Total collection value by date. Use the left and right arrow keys to move between readings.">
      ${grid}
      <path class="c-area" d="${area}"/>
      <path class="c-line" d="${line}"/>
      <line class="c-guide" x1="0" y1="${PAD.t}" x2="0" y2="${PAD.t + ih}" visibility="hidden"/>
      <rect class="c-plot" x="${PAD.l}" y="0" width="${iw}" height="${h}" fill="transparent"/>
      ${dots}
      <circle class="c-focus" cx="0" cy="0" r="7" visibility="hidden"/>
      ${xlabs}
    </svg>
    <div class="c-tip" role="status" aria-live="polite" hidden></div>
  </figure>`;
}

/* Wire hover / touch / keyboard on a container holding valueChart() output. */
export function bindChart(root) {
  const fig = root && root.querySelector('figure.chart');
  if (!fig) return;
  const data = JSON.parse(fig.dataset.pts || '[]');
  if (data.length < 2) return;
  const w = +fig.dataset.w, h = +fig.dataset.h;
  const svg = fig.querySelector('svg');
  const guide = fig.querySelector('.c-guide');
  const focus = fig.querySelector('.c-focus');
  const tip = fig.querySelector('.c-tip');
  const pts = [...fig.querySelectorAll('.c-pt')];
  let active = -1, pinned = false;

  const nearest = (clientX) => {
    // Map through the SVG's real screen transform: with preserveAspectRatio
    // "meet" and a max-height, the plot is letterboxed inside the element, so
    // the bounding box is NOT the drawing area.
    const m = svg.getScreenCTM();
    const vx = m ? (clientX - m.e) / m.a : ((clientX - svg.getBoundingClientRect().left) / svg.getBoundingClientRect().width) * w;
    let best = 0, bd = Infinity;
    data.forEach((p, i) => { const d = Math.abs(p.x - vx); if (d < bd) { bd = d; best = i; } });
    return best;
  };

  function show(i) {
    active = i;
    const p = data[i];
    guide.setAttribute('x1', p.x); guide.setAttribute('x2', p.x);
    guide.setAttribute('visibility', 'visible');
    focus.setAttribute('cx', p.x); focus.setAttribute('cy', p.y);
    focus.setAttribute('visibility', 'visible');
    pts.forEach((g, k) => g.classList.toggle('on', k === i));
    const chg = p.d == null
      ? '<span class="ct-chg flat">First reading</span>'
      : `<span class="ct-chg ${p.d >= 0 ? 'up' : 'down'}">${signed(p.d)} (${p.pct >= 0 ? '+' : '−'}${Math.abs(p.pct).toFixed(1)}%)
           <small>since ${esc(p.since)}</small></span>`;
    tip.innerHTML = `<div class="ct-date">${esc(p.date)}</div>
      <div class="ct-total">${usd(p.total)}</div>
      ${chg}
      <dl class="ct-rows">
        ${p.cards_total != null ? `<dt>Cards${p.cards != null ? ` (${p.cards})` : ''}</dt><dd>${usd(p.cards_total)}</dd>` : ''}
        ${p.sealed_total != null ? `<dt>Sealed</dt><dd>${usd(p.sealed_total)}</dd>` : ''}
      </dl>`;
    tip.hidden = false;
    place(p);
  }

  // Keep the card inside the figure: beside the point, flipping sides near
  // the edges, above the point when there's room and below it otherwise.
  function place(p) {
    const fr = fig.getBoundingClientRect(), ctm = svg.getScreenCTM();
    let px, py;
    if (ctm) { px = ctm.a * p.x + ctm.e - fr.left; py = ctm.d * p.y + ctm.f - fr.top; }
    else {
      const sr = svg.getBoundingClientRect();
      px = sr.left - fr.left + (p.x / w) * sr.width; py = sr.top - fr.top + (p.y / h) * sr.height;
    }
    const tw = tip.offsetWidth, th = tip.offsetHeight, gap = 14, m = 6;
    let left = px + gap;
    if (left + tw > fr.width - m) left = px - gap - tw;
    left = Math.max(m, Math.min(left, fr.width - tw - m));
    let top = py - th - gap;
    if (top < m) top = py + gap;
    top = Math.max(m, Math.min(top, fr.height - th - m));
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }

  function hide() {
    if (pinned) return;
    active = -1;
    guide.setAttribute('visibility', 'hidden');
    focus.setAttribute('visibility', 'hidden');
    pts.forEach((g) => g.classList.remove('on'));
    tip.hidden = true;
  }

  // Mouse: follow the pointer. Touch/pen: tap or drag to scrub; the reading
  // stays up after the finger lifts, until a tap elsewhere.
  svg.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || e.buttons) show(nearest(e.clientX));
  });
  svg.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') { pinned = true; show(nearest(e.clientX)); }
  });
  svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  document.addEventListener('pointerdown', (e) => {
    if (pinned && !fig.contains(e.target)) { pinned = false; hide(); }
  });

  // Keyboard: roving tabindex across the points.
  const move = (i) => {
    i = Math.max(0, Math.min(data.length - 1, i));
    pts.forEach((g, k) => g.setAttribute('tabindex', k === i ? '0' : '-1'));
    pts[i].focus({ preventScroll: true });
  };
  pts.forEach((g, i) => {
    g.addEventListener('focus', () => show(i));
    g.addEventListener('blur', () => setTimeout(() => {
      if (!fig.contains(document.activeElement)) hide();
    }, 0));
    g.addEventListener('keydown', (e) => {
      const k = { ArrowRight: i + 1, ArrowUp: i + 1, ArrowLeft: i - 1, ArrowDown: i - 1, Home: 0, End: data.length - 1 }[e.key];
      if (k !== undefined) { e.preventDefault(); move(k); }
      if (e.key === 'Escape') { pinned = false; g.blur(); hide(); }
    });
  });
  addEventListener('resize', () => { if (active >= 0) place(data[active]); });
}

function niceTicks(lo, hi, n) {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || mag * 10;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
  return out;
}
