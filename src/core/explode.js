// Explosions, damage and death. Knows nothing about turns or movement.
export const REACH = 8; // a body this far beyond the blast radius still feels it
export const DEATH_BLAST = { r: 25, damage: 15 };
const KNOCKBACK = 6; // px/s of push per point of damage at the centre
const MIN_KICK = 40; // pushes weaker than this leave a grounded soldier standing
const LIFT = 0.45; // upward bias of every push

// Centre of a soldier's body, where blasts measure their distance to.
export const bodyCentre = (unit) => ({ x: unit.x, y: unit.y - 10 });

// Take hp off a living soldier and report it. Death itself is settled by resolveDeaths.
export function hurt(world, unit, amount) {
  if (!unit.alive || amount <= 0) return;
  unit.hp = Math.max(0, unit.hp - amount);
  world.events.push({ type: 'damage', unit: unit.id, amount, x: unit.x, y: unit.y - 10 });
}

function push(unit, dx, dy, d, strength) {
  const len = d || 1;
  let nx = d ? dx / len : 0;
  let ny = d ? dy / len : -1;
  ny -= LIFT;
  const norm = Math.hypot(nx, ny);
  nx /= norm;
  ny /= norm;
  unit.vx += nx * strength;
  if (unit.onGround && strength < MIN_KICK && ny * strength >= 0) return; // pressed into the ground
  if (unit.onGround) unit.peakY = unit.y; // a fall is measured from where he left the ground
  unit.onGround = false;
  unit.vy += ny * strength;
}

// The death event for `u` (already marked dead). decisive: it left his team with nobody
// standing, so it is the kill that decides the match (the fx slow motion keys off it).
export function deathEvent(world, u, y = u.y) {
  const decisive = !world.teams[u.team].units.some((v) => v.alive);
  return { type: 'death', unit: u.id, x: u.x, y, decisive };
}

// Soldiers at 0 hp die: a death event, then a small blast of their own.
export function resolveDeaths(world) {
  const dying = [];
  for (const team of world.teams) {
    for (const u of team.units) if (u.alive && u.hp <= 0) dying.push(u);
  }
  for (const u of dying) u.alive = false;
  for (const u of dying) world.events.push(deathEvent(world, u));
  for (const u of dying) explode(world, u.x, u.y - 8, DEATH_BLAST.r, DEATH_BLAST.damage);
}

// Carve a crater, hurt and shove every living soldier within r + 8 of (x, y).
// Damage falls off linearly: damage * (1 - d / r). `direct` (a unit id) takes full damage,
// for hitscan hits that land on the body edge.
export function explode(world, x, y, r, damage, direct = null) {
  world.terrain.carve(x, y, r);
  world.events.push({ type: 'explosion', x, y, r });
  world.events.push({ type: 'crater', x, y, r });
  for (const team of world.teams) {
    for (const u of team.units) {
      if (!u.alive) continue;
      const c = bodyCentre(u);
      const d = Math.hypot(c.x - x, c.y - y);
      if (d >= r + REACH && u.id !== direct) continue;
      const amount = u.id === direct ? damage : Math.max(0, Math.round(damage * (1 - d / r)));
      hurt(world, u, amount);
      const fall = Math.max(0, 1 - d / (r + REACH));
      push(u, c.x - x, c.y - y, d, fall * Math.max(amount, damage * 0.3) * KNOCKBACK);
    }
  }
  resolveDeaths(world);
}
