// Particle pool. A particle is plain data a renderer can draw as-is:
//   x y vx vy   position (world px) and velocity (px/s)
//   life max    seconds left and total seconds, so life / max is the fade
//   size grow   radius in px and its change per second
//   color       css colour string
//   kind        'spark' | 'smoke' | 'debris' | 'ember' | 'splash' | 'dust'
//   gravity     px/s^2 added to vy (negative rises)
//   drag        fraction of velocity lost per second (exponential)
//   additive    draw with 'lighter'
//   bounce      0 ignores terrain; > 0 reflects off solid ground with that restitution
export const MAX_PARTICLES = 600;

export function makeParticle(p) {
  const life = p.life ?? 1;
  return {
    x: 0, y: 0, vx: 0, vy: 0, size: 2, grow: 0, color: '#fff', kind: 'spark',
    gravity: 0, drag: 0, additive: false, bounce: 0, ...p, life, max: life,
  };
}

// Oldest particles go first when the pool is full.
export function addParticle(fx, p) {
  if (fx.particles.length >= MAX_PARTICLES) fx.particles.shift();
  fx.particles.push(p);
}

const SETTLE_SPEED = 40; // px/s: a bouncing particle slower than this comes to rest
const SIDE_DAMP = 0.7; // sideways speed kept after a floor hit

// A bouncing particle that ends a step inside solid ground goes back to where it was and
// reflects off whichever axis was blocked. One that starts inside ground is left to escape.
function collide(p, terrain, ox, oy) {
  if (terrain.solid(ox, oy) || !terrain.solid(p.x, p.y)) return;
  if (!terrain.solid(p.x, oy)) {
    p.y = oy;
    p.vy = -p.vy * p.bounce;
    p.vx *= SIDE_DAMP;
    if (Math.abs(p.vy) < SETTLE_SPEED) { p.vx = 0; p.vy = 0; p.gravity = 0; }
  } else if (!terrain.solid(ox, p.y)) {
    p.x = ox;
    p.vx = -p.vx * p.bounce;
  } else {
    p.x = ox;
    p.y = oy;
    p.vx = 0;
    p.vy = 0;
    p.gravity = 0;
  }
}

export function stepParticles(list, dt, terrain) {
  let n = 0;
  for (const p of list) {
    p.life -= dt;
    if (p.life <= 0) continue;
    const damp = p.drag ? Math.exp(-p.drag * dt) : 1;
    p.vx *= damp;
    p.vy = p.vy * damp + p.gravity * dt;
    const ox = p.x;
    const oy = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (terrain && p.bounce) collide(p, terrain, ox, oy);
    p.size = Math.max(0, p.size + p.grow * dt);
    list[n++] = p;
  }
  list.length = n;
}
