// Which cells of the terrain canvas a crater clears. DOM-free so node can test it against the
// core's own carve. A cell (k x k world px) was baked from its centre pixel (k >> 1 in, see
// sampleMask), so it is cleared exactly when Terrain.carve removes that pixel: |dy| <= r and
// |dx| <= floor(sqrt(r^2 - dy^2)) about (round(x), round(y)). Returns row spans [row, x0, x1]
// (inclusive) in canvas cells; spans may run past the canvas edge, where drawing clips them.
export function craterSpans(x, y, r, k) {
  const cx = Math.round(x);
  const cy = Math.round(y);
  const c = k >> 1;
  const reach = Math.ceil(r);
  const spans = [];
  for (let row = Math.ceil((cy - reach - c) / k); row <= Math.floor((cy + reach - c) / k); row++) {
    const dy = row * k + c - cy;
    const rem = r * r - dy * dy;
    if (rem < 0) continue;
    const half = Math.floor(Math.sqrt(rem));
    const x0 = Math.ceil((cx - half - c) / k);
    const x1 = Math.floor((cx + half - c) / k);
    if (x0 <= x1) spans.push([row, x0, x1]);
  }
  return spans;
}
