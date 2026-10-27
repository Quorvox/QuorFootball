// Линейный график на SVG. Цвета берём из темы, поэтому он читается и на светлом, и на тёмном.
import { h, svgEl, fmtShort } from './ui.js';

export function lineChart(points, { unit = '', empty = 'Мало данных для графика.', decimals = 0 } = {}) {
  if (points.length < 2) return h('p', { class: 'muted', text: empty });
  const W = 320; const H = 150; const L = 36; const R = 10; const T = 12; const B = 26;
  const vals = points.map((p) => p.value);
  const lo = Math.floor(Math.min(...vals) - (decimals ? 1 : 0));
  const hi = Math.ceil(Math.max(...vals) + (decimals ? 1 : 0)) || lo + 1;
  const t0 = new Date(points[0].date).getTime();
  const t1 = new Date(points[points.length - 1].date).getTime();
  const x = (d) => L + ((new Date(d).getTime() - t0) / (t1 - t0 || 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const svg = svgEl('svg', {
    class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img',
    'aria-label': `График ${unit}: с ${fmtShort(points[0].date)} по ${fmtShort(points[points.length - 1].date)}, от ${vals[0]} до ${vals[vals.length - 1]}`,
  });
  for (const v of [lo, (lo + hi) / 2, hi]) {
    svg.append(svgEl('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: 'currentColor', 'stroke-opacity': 0.18 }));
    const t = svgEl('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' });
    t.textContent = decimals ? (Math.round(v * 10) / 10) : Math.round(v);
    svg.append(t);
  }
  svg.append(svgEl('polyline', { points: points.map((p) => `${x(p.date)},${y(p.value)}`).join(' '), fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
  points.forEach((p) => svg.append(svgEl('circle', { cx: x(p.date), cy: y(p.value), r: 4, fill: 'var(--accent)', stroke: 'currentColor', 'stroke-width': 2 })));
  for (const [p, anchor] of [[points[0], 'start'], [points[points.length - 1], 'end']]) {
    const t = svgEl('text', { x: anchor === 'start' ? L : W - R, y: H - 6, 'text-anchor': anchor });
    t.textContent = fmtShort(p.date);
    svg.append(t);
  }
  return svg;
}
