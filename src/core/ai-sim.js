// Shot simulation for the computer opponent. Everything here runs stepProjectile on a cloned
// projectile and a read-only view of the world: nothing is ever carved, damaged or pushed.
import { stepProjectile } from './physics.js';
import { makeProjectile, muzzle, MAX_SPEED } from './weapons.js';
import { REACH } from './explode.js';
import { DEG } from './math.js';

const MAX_SIM = 6; // s; a bouncer can return null for ever
const SELF_WEIGHT = 1.5; // friendly fire hurts more than enemy damage helps
const GRADIENT = 0.02; // tie-breaker that pulls a harmless shot toward the nearest enemy
const REFINE_VALUE = -GRADIENT * 150; // a coarse shot that lands farther than this from every enemy is not worth refining

// What stepProjectile needs, minus the shooter (his shells start clear of his body anyway).
export function simWorldFor(world, shooter) {
  const { terrain, wind, gravity, level, liquidY } = world;
  const teams = world.teams.map((t) => ({ units: t.units.filter((u) => u.alive && u.id !== shooter.id) }));
  return { terrain, wind, gravity, level, liquidY, teams };
}

// Fly one shell until it bursts. Returns { hit: 'terrain'|'unit'|'fuse'|'liquid'|'out'|'timeout', x, y }.
// A bouncer that has come to rest repeats the same step for ever, so once a step changes nothing
// only the fuse and the clock still run.
function flyShell(sw, w, mx, my, vx, vy, dt) {
  const p = makeProjectile(w, -1, mx, my, vx, vy);
  let fuse = w.fuse;
  let still = false;
  for (let t = 0; t < MAX_SIM; t += dt) {
    if (!still) {
      const { x, y, vx: ux, vy: uy } = p;
      const hit = stepProjectile(p, sw, dt);
      if (p.y >= sw.liquidY) return { hit: 'liquid', x: p.x, y: p.y };
      if (hit) return hit;
      still = p.x === x && p.y === y && p.vx === ux && p.vy === uy;
    }
    if (fuse != null && (fuse -= dt) <= 0) return { hit: 'fuse', x: p.x, y: p.y };
  }
  return { hit: 'timeout', x: p.x, y: p.y };
}

// Fire from feet (org.x, org.y) at `deg` above horizontal, facing -1|1, power 0..1.
function shotImpact(sw, w, org, facing, deg, power, dt) {
  const a = deg * DEG;
  const d = { x: facing * Math.cos(a), y: -Math.sin(a) };
  const m = muzzle(org, d);
  const v = power * MAX_SPEED;
  return flyShell(sw, w, m.x, m.y, d.x * v, d.y * v, dt);
}

// Net expected damage of an impact (enemy damage minus weighted own damage), plus a small pull
// toward the nearest enemy so a miss still has a gradient to follow.
export function impactValue(impact, w, ctx) {
  const bursts = impact.hit === 'terrain' || impact.hit === 'unit' || impact.hit === 'fuse';
  let value = 0;
  let nearest = Infinity;
  const dmg = (c) => {
    const d = Math.hypot(c.x - impact.x, c.y - impact.y);
    const hurts = bursts && d < w.r + REACH;
    return { d, amount: hurts ? Math.max(0, Math.round(w.damage * (1 - d / w.r))) : 0 };
  };
  for (const c of ctx.enemies) {
    const r = dmg(c);
    value += r.amount;
    nearest = Math.min(nearest, r.d);
  }
  for (const c of ctx.own) value -= SELF_WEIGHT * dmg(c).amount;
  return value - GRADIENT * nearest;
}

// Sweep an angle x power grid; returns the best { deg, power, value, impact }.
function sweep(sw, w, ctx, org, facing, g) {
  let best = null;
  for (let deg = g.a0; deg <= g.a1 + 1e-9; deg += g.aStep) {
    for (let power = g.p0; power <= g.p1 + 1e-9; power += g.pStep) {
      ctx.work.sims++;
      const impact = shotImpact(sw, w, org, facing, deg, power, g.dt);
      const value = impactValue(impact, w, ctx);
      if (!best || value > best.value) best = { deg, power, value, impact };
    }
  }
  return best;
}

const COARSE = { a0: -10, a1: 86, aStep: 6, p0: 0.2, p1: 1, pStep: 0.08, dt: 1 / 30 };
const FAST = { ...COARSE, aStep: 8, pStep: 0.1 };

// Coarse grid, then refinements around the winner: each a 5 x 5 grid at half the last spacing
// (one fewer when `fast`, for secondary spots). Only the last flies at the game's own 1/60 s.
export function bestShot(sw, w, ctx, org, facing, fast = false) {
  const grid = fast ? FAST : COARSE;
  let best = sweep(sw, w, ctx, org, facing, grid);
  let spanA = grid.aStep;
  let spanP = grid.pStep;
  const passes = fast ? 2 : 3;
  for (let pass = 0; pass < passes && best.value > REFINE_VALUE; pass++) {
    const aStep = spanA / 2;
    const pStep = spanP / 2;
    const g = {
      a0: Math.max(-20, best.deg - spanA), a1: Math.min(90, best.deg + spanA), aStep,
      p0: Math.max(0.1, best.power - spanP), p1: Math.min(1, best.power + spanP), pStep,
      dt: pass === passes - 1 ? 1 / 60 : 1 / 30,
    };
    best = sweep(sw, w, ctx, org, facing, g);
    spanA = aStep;
    spanP = pStep;
  }
  return best;
}
