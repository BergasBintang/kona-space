// A smooth line through points that never overshoots them: a "monotone cubic" curve (Fritsch and Carlson). Between two points the line only rises or falls, so a flat
// stretch of zero days stays flat and a single spike does not dip below the floor before it climbs. Used by the per-day chart of the Costs page.

/** The `d` of an SVG path through `pts` (x increasing). One point gives only a move; two give a straight line. */
export function smoothPath(pts: readonly (readonly [number, number])[]): string {
  const n = pts.length;
  if (n === 0) return "";
  const f = (v: number) => Math.round(v * 100) / 100;
  if (n === 1) return `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const dx = pts.slice(0, -1).map((p, i) => pts[i + 1][0] - p[0]);
  const m = dx.map((d, i) => (pts[i + 1][1] - pts[i][1]) / (d || 1)); // the slope of each piece
  const t = new Array<number>(n); // the slope of the line at each point
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) t[i] = 0; // a peak, a valley or a flat piece: level out, never overshoot
    else { const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1]; t[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i]); }
  }
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${f(pts[i][0] + h)} ${f(pts[i][1] + t[i] * h)} ${f(pts[i + 1][0] - h)} ${f(pts[i + 1][1] - t[i + 1] * h)} ${f(pts[i + 1][0])} ${f(pts[i + 1][1])}`;
  }
  return d;
}
