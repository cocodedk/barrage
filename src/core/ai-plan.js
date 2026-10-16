// The computer opponent's decision: which weapon, where to stand, how to aim and charge.
import { weaponById } from './weapons.js';
import { activeUnit } from './turns.js';
import { bodyCentre } from './explode.js';
import { simWorldFor, bestShot, impactValue } from './ai-sim.js';

const MAX_AIM_NOISE = (25 * Math.PI) / 180; // at skill 0
const MAX_POWER_NOISE = 0.25;
const MAX_TARGET_NOISE = 150; // px of airstrike x error at skill 0
const GOOD_VALUE = 12; // net damage below which a shot counts as "no clear shot"
const CLOSE = 80; // enemy this near: grenade or dynamite country
const WALK_OFFSETS = [160, 80, -160, -80]; // toward the enemy first, far before near
const SIM_BUDGET = 800; // shots simulated before the optional stages (grenade, walking) are skipped
const MIN_POWER = 0.1;
const AIM_LIMIT = Math.PI / 2;
const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const centreOf = (x, y) => ({ x, y: y - 10 });

// Feet y of walkable ground near (x, y), or null if there is none within climbing/dropping reach.
function groundNear(t, x, y) {
  const ix = Math.round(x);
  let yy = Math.round(y);
  for (let n = 0; t.solid(ix, yy); n++) if (n > 3 || --yy < 0) return null;
  for (let n = 0; !t.solid(ix, yy + 1); n++) if (n > 12 || ++yy >= t.h) return null;
  return yy;
}

// Where a walk of `off` px ends ({x, y} feet), or null if it is steep, a cliff or drowns.
function walkEnd(world, u, off) {
  const t = world.terrain;
  const dir = Math.sign(off);
  let y = u.y;
  let drop = 0;
  for (let s = 3; s <= Math.abs(off); s += 3) {
    const next = groundNear(t, u.x + dir * s, y);
    if (next === null) return null;
    drop += Math.max(0, next - y);
    y = next;
    if (drop > 40 || y > world.liquidY - 15) return null;
  }
  const x = u.x + off;
  return x < 20 || x > t.w - 20 ? null : { x, y };
}

// Open sky above x down to the soldier's head, so the missiles reach him.
function skyOpen(t, x, headY) {
  for (let y = 0; y < headY - 14; y += 6) if (t.solid(x, y)) return false;
  return true;
}

// Best bazooka/grenade shot from feet `org`, trying the given facings (default: toward enemies).
function ballisticPlan(sw, ctx, org, skill, facings, fast = false) {
  const near = ctx.enemies.some((c) => Math.hypot(c.x - org.x, c.y - (org.y - 10)) <= CLOSE);
  const sides = facings || [...new Set(ctx.enemies.map((c) => (c.x >= org.x ? 1 : -1)))];
  let best = null;
  const consider = (id) => {
    const w = weaponById(id);
    for (const facing of sides) {
      const s = bestShot(sw, w, ctx, org, facing, fast);
      if (!best || s.value > best.value) best = { ...s, weapon: id, facing };
    }
  };
  consider('bazooka');
  if (skill >= 0.3 && (near || best.value < GOOD_VALUE) && ctx.work.sims < SIM_BUDGET) consider(skill >= 0.6 ? 'cluster' : 'grenade');
  return best;
}

// Walk a few steps toward (or away from) the enemy and shoot from there.
function walkPlan(world, sw, ctx, u, skill, towards) {
  let best = null;
  const offs = WALK_OFFSETS.slice().sort((a, b) => Math.sign(b) * towards - Math.sign(a) * towards);
  for (const off of offs) {
    const end = ctx.work.sims < SIM_BUDGET && walkEnd(world, u, off);
    if (!end) continue;
    const here = { enemies: ctx.enemies, own: [...ctx.mates, centreOf(end.x, end.y)], work: ctx.work };
    const s = ballisticPlan(sw, here, end, skill, [Math.sign(off)], true);
    if (!best || s.value > best.value) best = { ...s, moveSteps: off, x: end.x };
    if (s.value >= GOOD_VALUE) break;
  }
  return best;
}

// Own soldiers (shooter included) must stay clear of every missile's line.
function airstrikePlan(world, u, enemies, mates) {
  const spread = [-80, -40, 0, 40, 80];
  const free = (x) => mates.every((m) => spread.every((o) => Math.abs(m.x - (x + o)) > 40));
  const open = enemies
    .filter((c) => skyOpen(world.terrain, c.x, c.y) && free(c.x) && Math.abs(c.x - u.x) > 40)
    .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x));
  return open.length ? { weapon: 'airstrike', x: open[0].x } : null;
}

function dynamitePlan(u, ctx) {
  const w = weaponById('dynamite');
  const at = { hit: 'fuse', x: u.x, y: u.y - 3 };
  const value = impactValue(at, w, { enemies: ctx.enemies, own: ctx.mates });
  if (value < GOOD_VALUE) return null;
  const nearest = ctx.enemies.reduce((a, b) => (Math.abs(b.x - u.x) < Math.abs(a.x - u.x) ? b : a));
  return { weapon: 'dynamite', retreat: nearest.x > u.x ? -1 : 1 };
}

// Choose this turn's shot. Returns { weapon, moveSteps, aim, power, facing, x, target?, retreat? }:
// aim in radians above horizontal, power 0..1, facing -1|1 the soldier must face when firing,
// x the planned standing x, target { x } for the airstrike, retreat -1|1 to walk off after dynamite.
export function aiPlan(world, rng) {
  const u = activeUnit(world);
  const skill = clamp(world.teams[u.team].ai?.skill ?? 1, 0, 1);
  const noiseA = (rng() * 2 - 1) * (1 - skill);
  const noiseP = (rng() * 2 - 1) * (1 - skill);
  const enemies = [];
  const mates = [];
  for (const team of world.teams) {
    for (const v of team.units) {
      if (!v.alive || v.id === u.id) continue;
      (team.id === u.team ? mates : enemies).push(bodyCentre(v));
    }
  }
  const idle = { weapon: 'bazooka', moveSteps: 0, aim: u.aim, power: 0.5, facing: u.facing, x: u.x };
  if (!enemies.length) return idle;
  const sw = simWorldFor(world, u);
  const ctx = { enemies, mates, own: [...mates, centreOf(u.x, u.y)], work: { sims: 0 } };
  const dyn = skill >= 0.5 && dynamitePlan(u, ctx); // only worth it when the enemy is right there
  if (dyn) return { ...idle, ...dyn, power: 0 };
  let pick = ballisticPlan(sw, ctx, u, skill);
  if (pick.value < GOOD_VALUE && skill >= 0.4) {
    const towards = Math.sign(enemies.reduce((a, c) => a + c.x - u.x, 0)) || 1;
    const walk = walkPlan(world, sw, ctx, u, skill, towards);
    if (walk && walk.value > pick.value) pick = walk;
  }
  if (pick.value < GOOD_VALUE && skill >= 0.4) {
    const strike = airstrikePlan(world, u, enemies, ctx.own);
    if (strike) {
      const x = strike.x + (rng() * 2 - 1) * MAX_TARGET_NOISE * (1 - skill);
      return { ...idle, weapon: 'airstrike', power: 0, target: { x } };
    }
  }
  return {
    weapon: pick.weapon, moveSteps: pick.moveSteps || 0, facing: pick.facing, x: pick.x ?? u.x,
    aim: clamp(pick.deg * DEG + noiseA * MAX_AIM_NOISE, -AIM_LIMIT, AIM_LIMIT),
    power: clamp(pick.power * (1 + noiseP * MAX_POWER_NOISE), MIN_POWER, 1),
  };
}
