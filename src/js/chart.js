/* Portfolio value over time — one series, so no legend and no categorical palette.
   Pure inline SVG: no chart library, consistent with the rest of the site. */
import { usd0, usd, esc } from './data.js';

const PAD = { t: 18, r: 16, b: 26, l: 52 };

export function valueChart(history, { w = 720, h = 210 } = {}) {
  const pts = (history || [])
    .map((p) => ({ ...p, t: new Date(p.date).getTime() }))
    .filter((p) => !isNaN(p.t) && typeof p.total === 'number')
    .sort((a, b) => a.t - b.t);

  if (!pts.length) {
    return `<div class="chart-empty">
      <strong>No price history yet.</strong>
      <span>Each “update prices” run appends a point here, and the line builds up over time.</span>
    </div>`;
  }

  const iw = w - PAD.l - PAD.r, ih = h - PAD.t - PAD.b;
  const vals = pts.map((p) => p.total);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo = lo * 0.9 || 0; hi = hi * 1.1 || 1; }   // single point: give it room
  const padY = (hi - lo) * 0.12; lo = Math.max(0, lo - padY); hi = hi + padY;

  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  const X = (t) => PAD.l + (t1 === t0 ? iw / 2 : ((t - t0) / (t1 - t0)) * iw);
  const Y = (v) => PAD.t + ih - ((v - lo) / (hi - lo)) * ih;

  // ~4 readable gridlines
  const ticks = niceTicks(lo, hi, 4);
  const grid = ticks.map((v) =>
    `<line class="c-grid" x1="${PAD.l}" y1="${Y(v).toFixed(1)}" x2="${w - PAD.r}" y2="${Y(v).toFixed(1)}"/>
     <text class="c-ylab" x="${PAD.l - 8}" y="${(Y(v) + 3.5).toFixed(1)}">${usd0(v)}</text>`).join('');

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.total).toFixed(1)}`).join(' ');
  const area = pts.length > 1
    ? `${line} L${X(t1).toFixed(1)},${(PAD.t + ih).toFixed(1)} L${X(t0).toFixed(1)},${(PAD.t + ih).toFixed(1)} Z`
    : '';

  const first = pts[0].total, last = pts[pts.length - 1].total;
  const up = last >= first;
  const dots = pts.map((p) => {
    const x = X(p.t).toFixed(1), y = Y(p.total).toFixed(1);
    return `<g class="c-pt" tabindex="0" role="img"
       aria-label="${esc(p.date)}: ${usd(p.total)}${p.cards != null ? `, ${p.cards} cards` : ''}">
      <circle class="c-hit" cx="${x}" cy="${y}" r="14"/>
      <circle class="c-dot" cx="${x}" cy="${y}" r="4.5"/>
      <title>${esc(p.date)} · ${usd(p.total)}${p.cards != null ? ` · ${p.cards} cards` : ''}</title>
    </g>`;
  }).join('');

  // first/last dates only — never a label on every point
  const xlabs = pts.length > 1
    ? `<text class="c-xlab" x="${PAD.l}" y="${h - 7}" text-anchor="start">${esc(pts[0].date)}</text>
       <text class="c-xlab" x="${w - PAD.r}" y="${h - 7}" text-anchor="end">${esc(pts[pts.length - 1].date)}</text>`
    : `<text class="c-xlab" x="${X(t0).toFixed(1)}" y="${h - 7}" text-anchor="middle">${esc(pts[0].date)}</text>`;

  const delta = pts.length > 1
    ? `<span class="c-delta ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${usd0(Math.abs(last - first))}
         (${first ? ((last - first) / first * 100).toFixed(1) : '0.0'}%)</span>`
    : `<span class="c-delta flat">first data point</span>`;

  return `<figure class="chart">
    <figcaption class="chart-head">
      <span class="chart-title">Collection value over time</span>${delta}
    </figcaption>
    <svg viewBox="0 0 ${w} ${h}" class="chart-svg ${up ? 'up' : 'down'}" role="img"
         aria-label="Line chart of total collection value by date">
      ${grid}
      ${area ? `<path class="c-area" d="${area}"/>` : ''}
      ${pts.length > 1 ? `<path class="c-line" d="${line}"/>` : ''}
      ${dots}
      ${xlabs}
    </svg>
  </figure>`;
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
