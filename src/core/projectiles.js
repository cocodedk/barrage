// World-level projectile handling: moves every shell, then bursts, splits or drops them.
import { stepProjectile } from './physics.js';
import { explode } from './explode.js';
import { BOMBLET, makeProjectile } from './weapons.js';
import { between } from './rng.js';

const BOMBLET_SPEED = [220, 320];
const BOMBLET_FAN = [Math.PI * 0.2, Math.PI * 0.8]; // upward arc, radians above horizontal

function releaseBomblets(world, p, rng) {
  for (let i = 0; i < BOMBLET.count; i++) {
    const a = BOMBLET_FAN[0] + ((BOMBLET_FAN[1] - BOMBLET_FAN[0]) * i) / (BOMBLET.count - 1);
    const v = between(rng, ...BOMBLET_SPEED);
    world.projectiles.push(makeProjectile(BOMBLET, p.owner, p.x, p.y - 8, Math.cos(a) * v, -Math.sin(a) * v));
  }
}

function burst(world, p, rng) {
  explode(world, p.x, p.y, p.radius, p.damage);
  if (p.kind === 'cluster') releaseBomblets(world, p, rng);
}

export function stepProjectiles(world, dt, rng) {
  const live = world.projectiles;
  world.projectiles = []; // survivors and anything a burst spawns land in here
  for (const p of live) {
    const hit = stepProjectile(p, world, dt);
    if (p.bounced) {
      p.bounced = false;
      world.events.push({ type: 'bounce', x: p.x, y: p.y });
    }
    if (p.y >= world.liquidY) {
      world.events.push({ type: 'splash', x: p.x, y: world.liquidY });
    } else if (hit) {
      if (hit.hit !== 'out') burst(world, { ...p, x: hit.x, y: hit.y }, rng);
    } else if (p.fuse != null && (p.fuse -= dt) <= 0) {
      burst(world, p, rng);
    } else {
      world.projectiles.push(p);
    }
  }
}
