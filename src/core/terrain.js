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

  // Sum of the offsets from (x, y) to every air pixel within `reach` (by solid()'s rules): a
  // vector pointing from the mask out into the air, zero when the box is all air or all solid.
  airVector(x, y, reach) {
    const { w, h, mask } = this;
    let nx = 0;
    let ny = 0;
    for (let dy = -reach; dy <= reach; dy++) {
      const iy = Math.floor(y + dy);
      if (iy >= h) continue;
      const row = iy * w;
      for (let dx = -reach; dx <= reach; dx++) {
        const ix = Math.floor(x + dx);
        if (iy < 0 || ix < 0 || ix >= w || mask[row + ix] !== 1) {
          nx += dx;
          ny += dy;
        }
      }
    }
    return { x: nx, y: ny };
  }

  // Remove a disc of radius r (x, y and r may be fractional). Returns how many solid
  // pixels it removed.
  carve(x, y, r) {
    const cx = Math.round(x);
    const cy = Math.round(y);
    const reach = Math.ceil(r);
    const { w, h, mask } = this;
    let removed = 0;
    for (let dy = Math.max(-reach, -cy); dy <= Math.min(reach, h - 1 - cy); dy++) {
      const rem = r * r - dy * dy;
      if (rem < 0) continue;
      const half = Math.floor(Math.sqrt(rem));
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
