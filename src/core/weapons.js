// The six weapons and what firing each one puts into the world.
import { explode, bodyCentre } from './explode.js';
import { hitsUnit } from './physics.js';

export const MAX_SPEED = 900; // px/s at full power
const MUZZLE = 18; // px from the body centre to where a shell appears
const RAY_RANGE = 900;
const RAY_START = 12; // clear of the shooter's own body
export const MISSILES = 5;
export const MISSILE_GAP = 40; // px between airstrike missiles
const MISSILE_SPEED = 300;

// Fields: blast radius `r` and `damage`; `fuse` seconds (null = bursts on contact);
// `restitution` > 0 makes a bouncer; `windy` shells feel the wind; `instant` weapons fire the
// moment Space is released, with no power charge; `shots` per turn.
export const WEAPONS = [
  { id: 'bazooka', name: 'Bazooka', icon: 'bazooka', r: 40, damage: 50, fuse: null, restitution: 0, windy: true, instant: false, shots: 1 },
  { id: 'grenade', name: 'Grenade', icon: 'grenade', r: 40, damage: 45, fuse: 3, restitution: 0.5, windy: false, instant: false, shots: 1 },
  { id: 'cluster', name: 'Cluster Bomb', icon: 'cluster', r: 40, damage: 45, fuse: 3, restitution: 0.5, windy: false, instant: false, shots: 1 },
  { id: 'airstrike', name: 'Airstrike', icon: 'airstrike', r: 25, damage: 25, fuse: null, restitution: 0, windy: false, instant: true, shots: 1 },
  { id: 'shotgun', name: 'Shotgun', icon: 'shotgun', r: 8, damage: 25, fuse: null, restitution: 0, windy: false, instant: true, shots: 2 },
  { id: 'dynamite', name: 'Dynamite', icon: 'dynamite', r: 70, damage: 75, fuse: 4, restitution: 0.2, windy: false, instant: true, shots: 1 },
];
export const BOMBLET = { kind: 'bomblet', r: 20, damage: 20, count: 5 };

export const weaponById = (id) => WEAPONS.find((w) => w.id === id);

export function makeProjectile(w, owner, x, y, vx, vy, extra = {}) {
  return {
    kind: w.id, x, y, vx, vy, windy: w.windy, fuse: w.fuse, restitution: w.restitution,
    radius: w.r, damage: w.damage, owner, ...extra,
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
  if (w.id === 'shotgun') return hitscan(world, u, w);
  if (w.id === 'dynamite') {
    world.projectiles.push(makeProjectile(w, u.id, u.x, u.y - 3, 0, 0));
  } else if (w.id === 'airstrike') {
    for (let i = 0; i < MISSILES; i++) {
      const x = target.x + (i - (MISSILES - 1) / 2) * MISSILE_GAP;
      world.projectiles.push(makeProjectile(w, u.id, x, -40, 0, MISSILE_SPEED, { kind: 'missile' }));
    }
  } else {
    const v = power * MAX_SPEED;
    world.projectiles.push(makeProjectile(w, u.id, m.x, m.y, d.x * v, d.y * v));
  }
}
