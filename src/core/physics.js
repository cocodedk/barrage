// Projectile physics. stepProjectile advances only `proj` (and sets proj.bounced on a bounce):
// it never carves, damages or pushes events, so the AI can run it to simulate shots.
const SUB_STEP = 4; // max px travelled between collision checks
export const UNIT_HALF_W = 6;
const UNIT_H = 20;
const REST_SPEED = 25; // a bounce slower than this leaves the projectile at rest
const BOUNCE_EVENT_SPEED = 60; // quieter impacts do not count as a bounce
const TANGENT_KEEP = 0.85;
const NORMAL_REACH = 4;

// Does a point (shell centre) touch the soldier body? Box 12 x 20 standing on the feet.
export function hitsUnit(unit, x, y) {
  return Math.abs(x - unit.x) <= UNIT_HALF_W + 1 && y >= unit.y - UNIT_H - 1 && y <= unit.y + 1;
}

// Unit vector pointing from the solid mask out into the air around (x, y).
function surfaceNormal(terrain, x, y, vx, vy) {
  let nx = 0;
  let ny = 0;
  for (let dy = -NORMAL_REACH; dy <= NORMAL_REACH; dy++) {
    for (let dx = -NORMAL_REACH; dx <= NORMAL_REACH; dx++) {
      if (!terrain.solid(x + dx, y + dy)) {
        nx += dx;
        ny += dy;
      }
    }
  }
  let len = Math.hypot(nx, ny);
  if (len < 1e-6) {
    nx = -vx;
    ny = -vy;
    len = Math.hypot(nx, ny);
  }
  return len < 1e-6 ? { x: 0, y: -1 } : { x: nx / len, y: ny / len };
}

function bounce(proj, terrain, px, py) {
  const n = surfaceNormal(terrain, proj.x, proj.y, proj.vx, proj.vy);
  proj.x = px;
  proj.y = py;
  const vn = proj.vx * n.x + proj.vy * n.y;
  if (vn >= 0) return; // already leaving the surface
  const tx = proj.vx - vn * n.x;
  const ty = proj.vy - vn * n.y;
  proj.vx = tx * TANGENT_KEEP - proj.restitution * vn * n.x;
  proj.vy = ty * TANGENT_KEEP - proj.restitution * vn * n.y;
  if (-vn > BOUNCE_EVENT_SPEED) proj.bounced = true;
  if (Math.hypot(proj.vx, proj.vy) < REST_SPEED) {
    proj.vx = 0;
    proj.vy = 0;
  }
}

function unitAt(world, x, y) {
  for (const team of world.teams) {
    for (const u of team.units) if (u.alive && hitsUnit(u, x, y)) return u;
  }
  return null;
}

// Advance one projectile by dt. Returns null while it is still flying (or just bounced), else
// { hit: 'terrain'|'unit'|'out', x, y, unit? }. Left/right/below the world is out; above the top
// is not, because shells may arc off screen and come back.
export function stepProjectile(proj, world, dt) {
  const { terrain } = world;
  const ax = proj.windy ? world.wind : 0;
  const ay = world.gravity;
  const drag = world.level.drag || 0;
  const reach = Math.hypot(proj.vx, proj.vy) * dt;
  const n = Math.max(1, Math.ceil(reach / SUB_STEP));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const px = proj.x;
    const py = proj.y;
    proj.x += proj.vx * h + 0.5 * ax * h * h;
    proj.y += proj.vy * h + 0.5 * ay * h * h;
    proj.vx += ax * h;
    proj.vy += ay * h;
    if (drag) {
      const keep = Math.max(0, 1 - drag * h);
      proj.vx *= keep;
      proj.vy *= keep;
    }
    if (proj.x < 0 || proj.x > terrain.w || proj.y >= terrain.h) {
      return { hit: 'out', x: proj.x, y: proj.y };
    }
    if (terrain.solid(proj.x, proj.y)) {
      if (proj.restitution > 0) {
        bounce(proj, terrain, px, py);
        continue;
      }
      return { hit: 'terrain', x: proj.x, y: proj.y };
    }
    if (!(proj.restitution > 0)) {
      const unit = unitAt(world, proj.x, proj.y);
      if (unit) return { hit: 'unit', x: proj.x, y: proj.y, unit };
    }
  }
  return null;
}
