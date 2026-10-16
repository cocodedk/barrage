// The controls and the six weapons at a glance, readable from the sofa: the demo's last step.
import { h } from './dom.js';

const KEYS = [
  ['← →  or  A D', 'Walk (climbs gentle slopes)'],
  ['↑ ↓  or  W S', 'Aim — or point with the mouse'],
  ['Enter', 'Jump'],
  ['Hold Space', 'Charge power, release to fire — or hold the mouse button'],
  ['Q E  or  1–6', 'Change weapon'],
  ['Esc · M', 'Pause · Sound on/off'],
];
const WEAPONS = [
  ['Bazooka', 'Rocket that bends with the wind. Bursts on contact.'],
  ['Grenade', 'Bounces, explodes after 3 s. Ignores wind.'],
  ['Cluster bomb', 'A grenade that scatters five bomblets.'],
  ['Airstrike', 'Five missiles from the sky. Aim the marker with ← → or the mouse, Space to call it.'],
  ['Shotgun', 'Instant ray, two shots per turn.'],
  ['Dynamite', 'Drop it, then run: 4 s fuse, a huge blast.'],
];

function table(rows, cls) {
  const t = h('dl', cls);
  for (const [k, v] of rows) t.append(h('dt', null, k), h('dd', null, v));
  return t;
}

export function howtoCards() {
  return h('div', 'howto-cols',
    h('div', 'card-panel', h('h3', null, 'Controls'), table(KEYS, 'keys')),
    h('div', 'card-panel', h('h3', null, 'Weapons'), table(WEAPONS, 'weapons')));
}
