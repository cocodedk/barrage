import { LEVELS_LATE } from './levels-2.js';

// Level data, plain and serialisable. World is 1920 x 1080, y down.
//   sky       [[stop 0..1, css colour], ...] top to bottom
//   layers    parallax silhouettes, far to near. A layer fills the bottom `height` px of
//             the world with a jagged outline of the given `kind`; `roughness` 0..1 is how
//             jagged; `speed` 0..1 is the camera-follow factor (small = far away).
//             kinds: hills mountains dunes forest pines skyline spikes waves blocks clouds
//   terrain   generator params, see terrain-gen.js
//   fill      [top, bottom] gradient of the ground; edge is the bright rim colour
//   liquid    { kind: 'water'|'lava', color, y } surface y of the death liquid
//   gravity   px/s^2
//   windMax   largest horizontal wind acceleration, px/s^2 (wind is rolled in [-max, max])
//   friction  ground grip 0..1: 1 stops a sliding soldier at once, 0 is ice
//   drag      fraction of projectile speed lost per second (water is thick)
//   aiSkill   0..1, the computer's accuracy and weapon sense
//   pixel     true: render chunky (level 12 only)
const EARLY = [
  {
    id: 1, name: 'Green Meadow',
    sky: [[0, '#4fb5ff'], [0.6, '#b4e6ff'], [1, '#f4fbe2']],
    layers: [
      { kind: 'mountains', color: '#8fb4d8', height: 520, roughness: 0.5, speed: 0.08 },
      { kind: 'hills', color: '#6db36a', height: 340, roughness: 0.35, speed: 0.2 },
      { kind: 'hills', color: '#4c9b52', height: 220, roughness: 0.3, speed: 0.4 },
    ],
    terrain: { base: 0.62, amp: 90, octaves: 3, roughness: 0.45, cells: 4 },
    fill: ['#7b5233', '#3b2515'], edge: '#72e24c',
    liquid: { kind: 'water', color: '#2a8fd6', y: 1020 },
    gravity: 600, windMax: 20, friction: 0.85, drag: 0.02, aiSkill: 0.25,
  },
  {
    id: 2, name: 'Desert Sunset',
    sky: [[0, '#3b1d63'], [0.45, '#d4476b'], [0.8, '#ff9a4a'], [1, '#ffd98a']],
    layers: [
      { kind: 'mountains', color: '#7a3a63', height: 460, roughness: 0.6, speed: 0.08 },
      { kind: 'dunes', color: '#b8584f', height: 330, roughness: 0.25, speed: 0.22 },
      { kind: 'dunes', color: '#8d3f45', height: 210, roughness: 0.2, speed: 0.42 },
    ],
    terrain: { base: 0.66, amp: 70, octaves: 2, roughness: 0.35, cells: 3,
      waves: { n: 3, amp: 50 }, platforms: { count: 2, w: [180, 300], y: [380, 520], thick: 28 } },
    fill: ['#dba45c', '#8a5a2b'], edge: '#ffe39a',
    liquid: { kind: 'water', color: '#2f7fa8', y: 1025 },
    gravity: 600, windMax: 45, friction: 0.75, drag: 0.02, aiSkill: 0.3,
  },
  {
    id: 3, name: 'Autumn Forest',
    sky: [[0, '#f6b26b'], [0.55, '#fbd9a0'], [1, '#fff1d4']],
    layers: [
      { kind: 'hills', color: '#c98a4b', height: 480, roughness: 0.4, speed: 0.08 },
      { kind: 'forest', color: '#b5632d', height: 380, roughness: 0.7, speed: 0.24 },
      { kind: 'forest', color: '#8c3f1d', height: 250, roughness: 0.75, speed: 0.44 },
    ],
    terrain: { base: 0.6, amp: 120, octaves: 4, roughness: 0.5, cells: 4,
      caves: { count: 2, r: [40, 60], depth: [90, 200] } },
    fill: ['#6b4226', '#2e1a0e'], edge: '#e98a2c',
    liquid: { kind: 'water', color: '#3d6f7a', y: 1020 },
    gravity: 600, windMax: 55, friction: 0.8, drag: 0.02, aiSkill: 0.35,
  },
  {
    id: 4, name: 'Arctic',
    sky: [[0, '#2a5a8c'], [0.5, '#8cc4e8'], [1, '#eaf7ff']],
    layers: [
      { kind: 'mountains', color: '#cfe6f6', height: 540, roughness: 0.55, speed: 0.08 },
      { kind: 'pines', color: '#7fa8c4', height: 330, roughness: 0.7, speed: 0.24 },
      { kind: 'hills', color: '#a9cde4', height: 220, roughness: 0.3, speed: 0.42 },
    ],
    terrain: { base: 0.64, amp: 100, octaves: 3, roughness: 0.4, cells: 3 },
    fill: ['#eef8ff', '#9cc4e4'], edge: '#ffffff',
    liquid: { kind: 'water', color: '#1f6fa0', y: 1020 },
    gravity: 600, windMax: 60, friction: 0.12, drag: 0.02, aiSkill: 0.4,
  },
  {
    id: 5, name: 'Jungle',
    sky: [[0, '#0e3b2e'], [0.5, '#2a8a5c'], [1, '#a8e08a']],
    layers: [
      { kind: 'hills', color: '#1f6b4a', height: 500, roughness: 0.5, speed: 0.08 },
      { kind: 'forest', color: '#13513a', height: 400, roughness: 0.85, speed: 0.25 },
      { kind: 'forest', color: '#0a3a2a', height: 270, roughness: 0.9, speed: 0.46 },
    ],
    terrain: { base: 0.6, amp: 150, octaves: 4, roughness: 0.55, cells: 5,
      caves: { count: 3, r: [35, 55], depth: [80, 220] },
      platforms: { count: 3, w: [140, 240], y: [360, 520], thick: 24 } },
    fill: ['#5a3d22', '#25170c'], edge: '#7de05a',
    liquid: { kind: 'water', color: '#2c6b4a', y: 1020 },
    gravity: 600, windMax: 30, friction: 0.7, drag: 0.03, aiSkill: 0.45,
  },
  {
    id: 6, name: 'Neon City',
    sky: [[0, '#07011a'], [0.6, '#2a0a4f'], [1, '#ff2d95']],
    layers: [
      { kind: 'skyline', color: '#2d1060', height: 520, roughness: 0.6, speed: 0.1 },
      { kind: 'skyline', color: '#1b0b3a', height: 380, roughness: 0.7, speed: 0.26 },
    ],
    terrain: { base: 0.64, amp: 110, octaves: 2, roughness: 0.4, cells: 4, quant: 40,
      platforms: { count: 4, w: [160, 280], y: [380, 560], thick: 30 } },
    fill: ['#1a1440', '#0a0818'], edge: '#00f0ff',
    liquid: { kind: 'water', color: '#ff2d95', y: 1020 },
    gravity: 600, windMax: 35, friction: 0.8, drag: 0.02, aiSkill: 0.5,
  },
  {
    id: 7, name: 'Candy Land',
    sky: [[0, '#b58cff'], [0.5, '#ff9ad5'], [1, '#ffe3f3']],
    layers: [
      { kind: 'clouds', color: '#ffd0ec', height: 560, roughness: 0.3, speed: 0.07 },
      { kind: 'hills', color: '#ff8fc7', height: 360, roughness: 0.25, speed: 0.22 },
      { kind: 'hills', color: '#d968b0', height: 230, roughness: 0.2, speed: 0.42 },
    ],
    terrain: { base: 0.64, amp: 70, octaves: 2, roughness: 0.4, cells: 3,
      waves: { n: 5, amp: 70 } },
    fill: ['#ff9ad5', '#b8479a'], edge: '#ffffff',
    liquid: { kind: 'water', color: '#ff5fb8', y: 1025 },
    gravity: 600, windMax: 40, friction: 0.7, drag: 0.02, aiSkill: 0.55,
  },
  {
    id: 8, name: 'Haunted Graveyard',
    sky: [[0, '#070a18'], [0.55, '#2a2f55'], [1, '#5a4a7a']],
    layers: [
      { kind: 'hills', color: '#1c1f3a', height: 460, roughness: 0.4, speed: 0.08 },
      { kind: 'forest', color: '#0e1022', height: 360, roughness: 0.95, speed: 0.25 },
      { kind: 'spikes', color: '#070813', height: 220, roughness: 0.8, speed: 0.44 },
    ],
    terrain: { base: 0.62, amp: 110, octaves: 4, roughness: 0.5, cells: 4,
      caves: { count: 2, r: [40, 60], depth: [90, 200] } },
    fill: ['#3b3350', '#15121f'], edge: '#9a8bc4',
    liquid: { kind: 'water', color: '#2e3a5c', y: 1020 },
    gravity: 600, windMax: 35, friction: 0.8, drag: 0.03, aiSkill: 0.6,
  },
];

export const LEVELS = [...EARLY, ...LEVELS_LATE];
