// The six weapons and what firing each one puts into the world.
import { explode, bodyCentre } from './explode.js';
import { hitsUnit } from './physics.js';

export const MAX_SPEED = 900; // px/s at full power
const MUZZLE = 18; // px from the body centre to where a shell appears
const RAY_RANGE = 900;
const RAY_START = 12; // clear of the shooter's own body
const MISSILES = 5;
export const MISSILE_GAP = 40; // px between airstrike missiles
// Each missile's x offset from the airstrike's target, centred on it.
export const MISSILE_OFFSETS = Array.from({ length: MISSILES }, (_, i) => (i - (MISSILES - 1) / 2) * MISSILE_GAP);
const MISSILE_SPEED = 300;

// Fields: blast radius `r` and `damage`; `fuse` seconds (null = bursts on contact);
// `restitution` > 0 makes a bouncer; `windy` shells feel the wind; `instant` weapons fire the
// moment Space is released, with no power charge; `shots` per turn. `target`: fired at a marked
// spot (the airstrike); `planted`: set down at the feet, not thrown (dynamite); `hitscan`: an
// instant ray, no shell (the shotgun).
export const WEAPONS = [
  { id: 'bazooka', name: 'Bazooka', r: 40, damage: 50, fuse: null, restitution: 0, windy: true, instant: false, shots: 1 },
  { id: 'grenade', name: 'Grenade', r: 40, damage: 45, fuse: 3, restitution: 0.5, windy: false, instant: false, shots: 1 },
  { id: 'cluster', name: 'Cluster Bomb', r: 40, damage: 45, fuse: 3, restitution: 0.5, windy: false, instant: false, shots: 1 },
  { id: 'airstrike', name: 'Airstrike', r: 25, damage: 25, fuse: null, restitution: 0, windy: false, instant: true, shots: 1, target: true },
  { id: 'shotgun', name: 'Shotgun', r: 8, damage: 25, fuse: null, restitution: 0, windy: false, instant: true, shots: 2, hitscan: true },
  { id: 'dynamite', name: 'Dynamite', r: 70, damage: 75, fuse: 4, restitution: 0.2, windy: false, instant: true, shots: 1, planted: true },
];
// What a cluster bomb scatters: weapon-shaped, so makeProjectile builds it like any shell.
export const BOMBLET = { id: 'bomblet', r: 20, damage: 20, fuse: null, restitution: 0, windy: false, count: 5 };

export const weaponById = (id) => WEAPONS.find((w) => w.id === id);

// Is projectile `p` flying (not planted)?
export const inFlight = (p) => !p.planted;

// Where planted dynamite sits under soldier `u`.
export const dropPoint = (u) => ({ x: u.x, y: u.y - 3 });

export function makeProjectile(w, owner, x, y, vx, vy, extra = {}) {
  return {
    kind: w.id, x, y, vx, vy, windy: w.windy, fuse: w.fuse, restitution: w.restitution,
    radius: w.r, damage: w.damage, planted: !!w.planted, owner, ...extra,
  };
}

export const aimDir = (u) => ({ x: u.facing * Math.cos(u.aim), y: -Math.sin(u.aim) });

// Where a shell leaves soldier `u` (feet x, y) fired along unit vector `d`.
export function muzzle(u, d) {
  const c = bodyCentre(u);
  return { x: c.x + d.x * MUZZLE, y: c.y + d.y * MUZZLE };
}

function hitscan(world, u, w) {
  const d = aimDir(u);
  const { x: cx, y: cy } = bodyCentre(u);
  const t = world.terrain;
  for (let s = RAY_START; s <= RAY_RANGE; s++) {
    const x = cx + d.x * s;
    const y = cy + d.y * s;
    if (x < 0 || x > t.w || y >= t.h) return;
    if (t.solid(x, y)) return explode(world, x, y, w.r, w.damage);
    for (const team of world.teams) {
      for (const v of team.units) {
        if (v.alive && v.id !== u.id && hitsUnit(v, x, y)) return explode(world, x, y, w.r, w.damage, v.id);
      }
    }
  }
}

// Fire weapon `w` from soldier `u`. power 0..1; target = { x } for the airstrike.
export function fireWeapon(world, u, w, power, target) {
  const d = aimDir(u);
  const m = muzzle(u, d);
  world.events.push({ type: 'fire', weapon: w.id, x: m.x, y: m.y });
  if (w.hitscan) return hitscan(world, u, w);
  if (w.planted) {
    const p = dropPoint(u);
    world.projectiles.push(makeProjectile(w, u.id, p.x, p.y, 0, 0));
  } else if (w.target) {
    for (const o of MISSILE_OFFSETS) {
      world.projectiles.push(makeProjectile(w, u.id, target.x + o, -40, 0, MISSILE_SPEED, { kind: 'missile' }));
    }
  } else {
    const v = power * MAX_SPEED;
    world.projectiles.push(makeProjectile(w, u.id, m.x, m.y, d.x * v, d.y * v));
  }
}
