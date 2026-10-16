// Destructible terrain: a w*h byte mask, 1 = solid. y grows downward.
export class Terrain {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.mask = new Uint8Array(w * h);
  }

  // Out of bounds is empty air, except below the world, which is solid.
  solid(x, y) {
    const iy = Math.floor(y);
    if (iy >= this.h) return true;
    const ix = Math.floor(x);
    if (ix < 0 || ix >= this.w || iy < 0) return false;
    return this.mask[iy * this.w + ix] === 1;
  }

  // Remove a disc of radius r. Returns how many solid pixels it removed.
  carve(x, y, r) {
    const cx = Math.round(x);
    const cy = Math.round(y);
    const { w, h, mask } = this;
    let removed = 0;
    for (let dy = Math.max(-r, -cy); dy <= Math.min(r, h - 1 - cy); dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy));
      const row = (cy + dy) * w;
      for (let x0 = Math.max(cx - half, 0); x0 <= Math.min(cx + half, w - 1); x0++) {
        if (mask[row + x0]) {
          mask[row + x0] = 0;
          removed++;
        }
      }
    }
    return removed;
  }

  // First solid y from the top in column x; h if the column is empty.
  surfaceY(x) {
    const ix = Math.floor(x);
    if (ix < 0 || ix >= this.w) return this.h;
    for (let y = 0; y < this.h; y++) if (this.mask[y * this.w + ix]) return y;
    return this.h;
  }
}
