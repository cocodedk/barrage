// Per-level art direction: everything the renderer needs beyond the level data's colours.
//   sky       celestial body baked into the sky (see sky.js)
//   trim      surface dressing baked onto the terrain (see terrain-view.js), trimColor its tint
//   tex       procedural ground texture (see terrain-tex.js)
//   glow      strength of the baked edge glow, 0..1
//   spikes    how the 'spikes' parallax kind is drawn: rocks | coral | fence | shards
//   ambient   { kind, n, colors, size:[lo,hi], speed, alpha } (see ambient.js)
//   flourish  signature animated extras (see flourish.js)
//   hot       crater rim glow colour, flash tint while a crater cools
const LOOKS = {
  1: {
    sky: 'sun', trim: 'grass', trimColor: '#3f9e2c', tex: 'soil', glow: 0.25, spikes: 'rocks',
    ambient: { kind: 'pollen', n: 45, colors: ['#fffbe0', '#ffffff', '#fff2a8'], size: [1.5, 3], speed: 14, alpha: 0.8 },
    flourish: ['clouds', 'birds'], hot: '#ffb347',
  },
  2: {
    sky: 'sunset', trim: 'sand', trimColor: '#f6cf86', tex: 'strata', glow: 0.3, spikes: 'rocks',
    ambient: { kind: 'dust', n: 70, colors: ['#ffd9a0', '#f0b87a'], size: [1, 2.4], speed: 60, alpha: 0.55 },
    flourish: ['birds', 'haze'], hot: '#ff9a3c',
  },
  3: {
    sky: 'hazy', trim: 'litter', trimColor: '#c4521c', tex: 'loam', glow: 0.25, spikes: 'rocks',
    ambient: { kind: 'leaves', n: 46, colors: ['#e8752a', '#c9401c', '#f2b234', '#a8551f'], size: [4, 7], speed: 40, alpha: 1 },
    flourish: ['rays'], hot: '#ff8a2a',
  },
  4: {
    sky: 'pale', trim: 'snow', trimColor: '#ffffff', tex: 'ice', glow: 0.3, spikes: 'shards',
    ambient: { kind: 'snow', n: 150, colors: ['#ffffff', '#eaf6ff'], size: [1.5, 4.5], speed: 50, alpha: 0.9 },
    flourish: ['aurora'], hot: '#ffcc88',
  },
  5: {
    sky: 'canopy', trim: 'jungle', trimColor: '#2f9e3a', tex: 'mud', glow: 0.25, spikes: 'rocks',
    ambient: { kind: 'fireflies', n: 42, colors: ['#d8ff6a', '#f4ff9a'], size: [5, 9], speed: 18, alpha: 1 },
    flourish: ['rays', 'mist'], hot: '#ffb347',
  },
  6: {
    sky: 'synth', trim: 'neon', trimColor: '#ff2d95', tex: 'city', glow: 0.95, spikes: 'rocks',
    ambient: { kind: 'rain', n: 110, colors: ['#7ff6ff', '#ff7ac8'], size: [10, 18], speed: 900, alpha: 0.35 },
    flourish: ['searchlights'], hot: '#00f0ff',
  },
  7: {
    sky: 'rainbow', trim: 'frosting', trimColor: '#ffffff', tex: 'candy', glow: 0.35, spikes: 'rocks',
    ambient: { kind: 'sparkles', n: 50, colors: ['#ffffff', '#fff3a0', '#9ff4ff', '#ffb8e6'], size: [5, 10], speed: 16, alpha: 1 },
    flourish: ['clouds'], hot: '#ff8ad8',
  },
  8: {
    sky: 'moon', trim: 'moss', trimColor: '#5c6b4a', tex: 'grave', glow: 0.45, spikes: 'fence',
    ambient: { kind: 'fog', n: 14, colors: ['#9a92c8', '#b8b0e0'], size: [120, 240], speed: 14, alpha: 0.09 },
    flourish: ['mist', 'bats'], hot: '#b48cff',
  },
  9: {
    sky: 'storm', trim: 'wet', trimColor: '#c9dceb', tex: 'rock', glow: 0.25, spikes: 'rocks',
    ambient: { kind: 'rain', n: 240, colors: ['#b8c8d8', '#dfe8f0'], size: [16, 30], speed: 1400, alpha: 0.4 },
    flourish: ['scud', 'lightning'], hot: '#ffd27a',
  },
  10: {
    sky: 'surface', trim: 'weed', trimColor: '#3fae6a', tex: 'coral', glow: 0.3, spikes: 'coral',
    ambient: { kind: 'bubbles', n: 55, colors: ['#d8fbff'], size: [2, 7], speed: 50, alpha: 0.7 },
    flourish: ['caustics', 'fish'], hot: '#ffe0a8',
  },
  11: {
    sky: 'volcano', trim: 'crust', trimColor: '#ff7a2a', tex: 'basalt', glow: 0.7, spikes: 'rocks',
    ambient: { kind: 'embers', n: 80, colors: ['#ffb14a', '#ff7a1a', '#ffd27a'], size: [2, 4], speed: 70, alpha: 1 },
    flourish: ['eruption'], hot: '#ff6a14',
  },
  12: {
    sky: 'pixelsun', trim: 'pixgrass', trimColor: '#2e9c2a', tex: 'bricks', glow: 0, spikes: 'rocks',
    ambient: { kind: 'pixels', n: 34, colors: ['#ffffff', '#ffe04a', '#7af0ff'], size: [4, 8], speed: 20, alpha: 1 },
    flourish: ['pixclouds'], hot: '#ffe04a',
  },
  13: {
    sky: 'halo', trim: 'ice', trimColor: '#ffffff', tex: 'glacier', glow: 0.45, spikes: 'shards',
    ambient: { kind: 'glitter', n: 90, colors: ['#ffffff', '#c8ecff'], size: [3, 6], speed: 22, alpha: 1 },
    flourish: ['glints'], hot: '#bfe8ff',
  },
  14: {
    sky: 'earth', trim: 'dust', trimColor: '#d8d8e4', tex: 'regolith', glow: 0.2, spikes: 'rocks',
    ambient: { kind: 'twinkle', n: 70, colors: ['#ffffff', '#cfe0ff', '#fff0d0'], size: [3, 6], speed: 0, alpha: 1 },
    flourish: ['shooting'], hot: '#ffe8c8',
  },
  15: {
    sky: 'eclipse', trim: 'ember', trimColor: '#ff4d2d', tex: 'obsidian', glow: 0.8, spikes: 'rocks',
    ambient: { kind: 'embers', n: 120, colors: ['#ff4d2d', '#ff8a3a', '#ffd0a0', '#ff2a1a'], size: [1.5, 3.5], speed: 110, alpha: 1 },
    flourish: ['meteors', 'ash'], hot: '#ff3d0a',
  },
};

const FALLBACK = LOOKS[1];
export const lookFor = (level) => LOOKS[level.id] ?? FALLBACK;
