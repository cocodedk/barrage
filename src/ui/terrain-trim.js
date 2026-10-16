// Surface dressing baked onto the terrain: the trim band under the surface (grass, snow,
// frosting...) and the bits that stick out into the air (blades, icicles, vines).
import { rgb, shade, mix, hash, hash2, noise2 } from './sprites.js';

const LEAVES = ['#e8752a', '#c9401c', '#f2b234'].map(rgb);
const SPRINKLES = ['#ff5a5a', '#5ac8ff', '#ffe65a', '#7ae67a'].map(rgb);

// depth [lo, hi] px of the band; light/dark its top and bottom colour; blades grow up,
// hang grows down from undersides. len in px, chance per column.
export function trimSpec(look, level) {
  const c = look.trimColor;
  const e = level.edge;
  const S = {
    grass: { depth: [5, 12], light: shade(c, 0.2), dark: shade(c, -0.35), blades: { len: 7, chance: 0.55, colors: [e, c] } },
    sand: { depth: [3, 6], light: c, dark: mix(c, level.fill[0], 0.6) },
    litter: { depth: [4, 9], light: c, dark: shade(c, -0.3), speck: LEAVES, blades: { len: 4, chance: 0.12, colors: ['#8a5a2a'] } },
    snow: { depth: [9, 18], light: '#ffffff', dark: '#cfe6f8', hang: { len: 12, chance: 0.22, colors: ['#e8f6ff'], taper: true } },
    jungle: {
      depth: [6, 12], light: '#4cc24a', dark: '#1e6b2a', blades: { len: 12, chance: 0.7, colors: [e, '#2f9e3a', '#1e7a2a'] },
      hang: { len: 40, chance: 0.05, colors: ['#2a7a3a', '#3a9a4a'] },
    },
    neon: { depth: [5, 7], light: '#ff2d95', dark: '#ff2d95', gap: 3 },
    frosting: { depth: [10, 20], light: '#ffffff', dark: '#ffe0f2', drips: true, speck: SPRINKLES },
    moss: { depth: [3, 7], light: '#55634a', dark: '#2c3326', blades: { len: 5, chance: 0.22, colors: ['#6b6f5a', '#4a5240'] } },
    wet: { depth: [2, 5], light: mix(c, level.fill[0], 0.5), dark: level.fill[0] },
    weed: { depth: [3, 6], light: '#ffb59a', dark: level.fill[0], blades: { len: 20, chance: 0.1, colors: ['#3fae6a', '#2a8a5a'], sway: true } },
    crust: { depth: [3, 7], light: '#5a2a14', dark: '#2a1410' },
    pixgrass: { depth: [8, 12], light: c, dark: shade(c, -0.35) },
    ice: { depth: [3, 5], light: '#ffffff', dark: '#dff2ff', hang: { len: 22, chance: 0.28, colors: ['#eaf8ff', '#c8ecff'], taper: true } },
    dust: { depth: [3, 6], light: '#cfcfdc', dark: mix('#cfcfdc', level.fill[0], 0.7) },
    ember: { depth: [3, 5], light: '#7a1a10', dark: '#2c1219' },
  };
  const s = S[look.trim] || S.grass;
  return {
    ...s, lightRgb: rgb(s.light), darkRgb: rgb(s.dark),
    blades: s.blades && { ...s.blades, rgbs: s.blades.colors.map(rgb) },
    hang: s.hang && { ...s.hang, rgbs: s.hang.colors.map(rgb) },
  };
}

// How deep the trim band reaches in each of `w` columns, k world px apart (once per bake).
export function trimDepths(T, w, k) {
  const out = new Float64Array(w);
  for (let c = 0; c < w; c++) {
    const x = c * k;
    let lo = T.depth[0] + (T.depth[1] - T.depth[0]) * noise2(x, 0, 23);
    if (T.drips && hash(x >> 3) > 0.72) lo += 8 + hash((x >> 3) + 99) * 26 * Math.sin(((x & 7) / 8) * Math.PI);
    out[c] = lo;
  }
  return out;
}

// Recolour `o` if pixel (x, y) at depth d lies in the trim band, `lo` deep in this column.
export function trimPixel(o, T, lo, x, y, d) {
  if (d > lo || (T.gap && d < T.gap)) return;
  const u = d / lo;
  for (let i = 0; i < 3; i++) o[i] = T.lightRgb[i] + (T.darkRgb[i] - T.lightRgb[i]) * u;
  if (T.speck && hash2(x >> 1, y >> 1) > (T.drips ? 0.96 : 0.6)) {
    const c = T.speck[Math.floor(hash2(y >> 1, x >> 1) * T.speck.length)];
    o[0] = c[0];
    o[1] = c[1];
    o[2] = c[2];
  }
}

function put(data, w, h, m, x, y, c) {
  if (x < 0 || x >= w || y < 0 || y >= h || m[y * w + x]) return;
  const i = (y * w + x) * 4;
  data[i] = c[0];
  data[i + 1] = c[1];
  data[i + 2] = c[2];
  data[i + 3] = 255;
}

// Blades up from every top surface and hangers down from every underside, into the air.
// m is the (possibly downsampled) mask, k the world px per mask px.
export function dress(data, m, w, h, k, T) {
  const { blades, hang } = T;
  if (!blades && !hang) return;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      const wx = x * k;
      if (blades && !m[(y - 1) * w + x] && hash(wx * 7 + 1) < blades.chance) {
        const len = Math.round((blades.len * (0.35 + 0.65 * hash(wx + 31))) / k);
        const c = blades.rgbs[Math.floor(hash(wx + 77) * blades.rgbs.length)];
        for (let i = 1; i <= len; i++) {
          const sx = blades.sway ? Math.round(Math.sin(i * 0.5 + wx) * 1.2) : 0;
          put(data, w, h, m, x + sx, y - i, c);
        }
      }
      if (hang && !m[(y + 1) * w + x] && hash(wx * 13 + 5) < hang.chance) {
        const len = Math.round((hang.len * (0.3 + 0.7 * hash(wx + 41))) / k);
        const c = hang.rgbs[Math.floor(hash(wx + 55) * hang.rgbs.length)];
        for (let i = 1; i <= len; i++) {
          put(data, w, h, m, x, y + i, c);
          if (hang.taper && i < len * 0.4) put(data, w, h, m, x + 1, y + i, c);
        }
      }
    }
  }
}

// Air the open sky can reach: a flood fill from the top and sides. Anything else that is
// air is a cave.
export function openAir(m, w, h) {
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let n = 0;
  const seed = (p) => {
    if (!m[p] && !seen[p]) {
      seen[p] = 1;
      queue[n++] = p;
    }
  };
  for (let x = 0; x < w; x++) seed(x);
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  for (let i = 0; i < n; i++) {
    const p = queue[i];
    const x = p % w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < w * (h - 1)) seed(p + w);
  }
  return seen;
}

// For each cave pixel (air the sky cannot reach), how far it is to the nearest solid pixel
// straight left, right, up or down; 0 elsewhere. Shades the cave's back wall.
export function caveDistance(m, open, w, h) {
  const n = w * h;
  const dist = new Uint16Array(n);
  const cave = new Uint8Array(n);
  let any = false;
  for (let p = 0; p < n; p++) {
    if (m[p] || open[p]) continue;
    cave[p] = 1;
    dist[p] = 65535;
    any = true;
  }
  if (!any) return dist;
  const sweep = (start, step, count, lines) => {
    for (let l = 0; l < lines; l++) {
      let run = 0;
      for (let i = 0, p = start(l); i < count; i++, p += step) {
        run = cave[p] ? run + 1 : 0;
        if (run && run < dist[p]) dist[p] = run;
      }
    }
  };
  sweep((y) => y * w, 1, w, h); // left to right
  sweep((y) => y * w + w - 1, -1, w, h); // right to left
  sweep((x) => x, w, h, w); // top down
  sweep((x) => (h - 1) * w + x, -w, h, w); // bottom up
  return dist;
}
