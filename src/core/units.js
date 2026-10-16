// Soldiers: walking, jumping, falling, sliding, landing and drowning. unit.y is the feet
// (the last air pixel above the ground); the body is 12 px wide and 20 px tall above it.
import { UNIT_HALF_W } from './physics.js';
import { hurt, deathEvent } from './explode.js';
import { clamp } from './math.js';

export const WALK_SPEED = 90; // px/s
export const JUMP_HEIGHT = 70; // px, kept under the safe fall height
export const SAFE_FALL = 80; // px of drop before it hurts
export const FALL_DAMAGE = 0.4; // hp per px beyond the safe height
export const AIM_LIMIT = Math.PI / 2;
const AT_REST = 5; // px/s under which a soldier counts as still
const STEP_DOWN = 2; // px a walker follows the ground down per move

export function createUnit(id, team, x, y, facing) {
  return {
    id, team, x, y, vx: 0, vy: 0, hp: 100, alive: true, facing, aim: 0.5, onGround: true, peakY: y,
  };
}

export const unitAtRest = (u) =>
  !u.alive || (u.onGround && Math.abs(u.vx) < AT_REST && Math.abs(u.vy) < AT_REST);

// Is any part of the body inside the ground? The lower body is sampled narrower than the
// torso, so a 1 px/px slope can be climbed and a 2 px/px wall cannot.
function blocked(t, x, y) {
  const w = UNIT_HALF_W;
  return (
    t.solid(x, y) || t.solid(x, y - 6) || t.solid(x, y - 12) || t.solid(x, y - 19) ||
    t.solid(x - w, y - 8) || t.solid(x + w, y - 8) ||
    t.solid(x - w, y - 14) || t.solid(x + w, y - 14) || t.solid(x - w, y - 19) || t.solid(x + w, y - 19)
  );
}

// Standing: the feet rest on ground, or the body cannot move 1 px down. The second half is the
// test flyBy lands on, so a soldier propped on a speck by his side or shoulder counts as standing
// and never flickers between landing and falling.
const grounded = (t, x, y) =>
  t.solid(x, y + 1) || t.solid(x - 4, y + 1) || t.solid(x + 4, y + 1) || blocked(t, x, y + 1);

function startFall(u) {
  u.onGround = false;
  u.peakY = u.y;
  u.vy = 0;
}

// Move along the ground by dx, 1 px at a time: step up 1 px, otherwise stop at a wall.
function walkBy(u, t, dx) {
  let rem = dx;
  while (Math.abs(rem) > 1e-9) {
    const step = clamp(rem, -1, 1);
    rem -= step;
    const nx = u.x + step;
    if (nx < UNIT_HALF_W || nx > t.w - UNIT_HALF_W) {
      u.vx = 0;
      return;
    }
    if (!blocked(t, nx, u.y)) u.x = nx;
    else if (!blocked(t, nx, u.y - 1)) {
      u.x = nx;
      u.y -= 1;
    } else {
      u.vx = 0;
      return;
    }
    // follow the ground down: a slope falls away under the centre while the uphill foot still holds
    for (let i = 0; i < STEP_DOWN && !t.solid(u.x, u.y + 1) && !blocked(t, u.x, u.y + 1); i++) u.y += 1;
  }
}

function land(world, u) {
  const impact = u.y - u.peakY;
  u.y = Math.floor(u.y);
  u.onGround = true;
  u.vy = 0;
  u.peakY = u.y;
  if (impact >= 4) world.events.push({ type: 'land', unit: u.id, impact });
  if (u.alive && impact > SAFE_FALL) hurt(world, u, Math.round((impact - SAFE_FALL) * FALL_DAMAGE));
}

// Free flight: x then y, 1 px at a time. Ceilings and walls stop that axis; a floor lands.
function flyBy(world, u, dx, dy) {
  const t = world.terrain;
  for (let rem = dx; Math.abs(rem) > 1e-9; ) {
    const step = clamp(rem, -1, 1);
    rem -= step;
    const nx = u.x + step;
    if (nx < UNIT_HALF_W || nx > t.w - UNIT_HALF_W || blocked(t, nx, u.y)) {
      u.vx = 0;
      break;
    }
    u.x = nx;
  }
  for (let rem = dy; Math.abs(rem) > 1e-9; ) {
    const step = clamp(rem, -1, 1);
    rem -= step;
    const ny = u.y + step;
    if (blocked(t, u.x, ny)) {
      if (step > 0) return land(world, u);
      u.vy = 0;
      break;
    }
    u.y = ny;
    u.peakY = Math.min(u.peakY, u.y);
  }
}

function drown(world, u) {
  u.hp = 0;
  u.alive = false;
  world.events.push({ type: 'splash', x: u.x, y: world.liquidY });
  world.events.push(deathEvent(world, u, world.liquidY));
}

// move = { dir: -1|0|1, jump: bool }; ignored for the dead.
export function stepUnit(world, u, dt, move = { dir: 0, jump: false }) {
  const t = world.terrain;
  const grip = world.level.friction;
  const dir = u.alive ? move.dir : 0;
  if (u.y >= world.liquidY) {
    if (u.alive) drown(world, u);
    return; // the dead lie where they sank
  }
  if (u.onGround && !grounded(t, u.x, u.y)) startFall(u);
  if (u.onGround) {
    u.vy = 0; // a downward shove into the ground leaves no vertical speed behind
    if (dir) u.facing = dir;
    if (u.alive && move.jump) {
      startFall(u);
      u.vy = -Math.sqrt(2 * world.gravity * JUMP_HEIGHT);
      u.vx = dir * WALK_SPEED;
      world.events.push({ type: 'jump', unit: u.id });
    } else if (dir) {
      const next = u.vx + dir * (200 + 1400 * grip) * dt;
      u.vx = clamp(next, -WALK_SPEED, WALK_SPEED);
    } else {
      const slow = (20 + grip * grip * 3000) * dt;
      u.vx = Math.abs(u.vx) <= slow ? 0 : u.vx - Math.sign(u.vx) * slow;
    }
  }
  if (u.onGround) {
    walkBy(u, t, u.vx * dt);
    if (!grounded(t, u.x, u.y)) startFall(u);
  } else {
    u.vy += world.gravity * dt;
    flyBy(world, u, u.vx * dt, u.vy * dt);
  }
  if (u.alive && u.y >= world.liquidY) {
    drown(world, u);
  }
}
