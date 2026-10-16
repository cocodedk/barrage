// Turns an aiPlan into the same intents a human would press, tick by tick: think, walk, pick the
// weapon, face and rotate the aim, then hold Space until the power is right and let go.
import { weaponById } from './weapons.js';
import { activeUnit, POWER_RATE, AIM_RATE } from './turns.js';
import { WALK_SPEED } from './units.js';

export const THINK_TIME = 0.6; // s of "thinking" before anything moves
const WALK_SLACK = 1; // s beyond the ideal walk time before the AI gives up on reaching x
const WALK_TOL = 2; // px; a stopped walker slides about this far
const AIM_TOL = AIM_RATE / 60 / 2; // half a tick of rotation: closer than this is on target
const POWER_TOL = POWER_RATE / 120; // half a tick of charging

const walk = (dir) => (dir < 0 ? { left: true } : { right: true });

// Intents for one logic tick while it is the AI's turn and the phase is 'aim' (also call it in
// 'retreat': a dynamite plan walks away from the fuse). `elapsed` = seconds since the turn's
// aim phase began; `world` supplies the live soldier and power, so aiming is closed-loop.
export function aiIntents(plan, elapsed, world) {
  const turn = world.turn;
  if (turn.phase === 'retreat') return plan.retreat ? walk(plan.retreat) : {};
  if (turn.phase !== 'aim' || elapsed < THINK_TIME) return {};
  const u = activeUnit(world);
  if (!u.onGround) return {};
  const dx = plan.x - u.x;
  const walkTime = Math.abs(plan.moveSteps) / WALK_SPEED + WALK_SLACK;
  if (plan.moveSteps && elapsed < THINK_TIME + walkTime && Math.abs(dx) > WALK_TOL) return walk(dx);
  const w = weaponById(plan.weapon);
  const out = { weapon: w.id };
  if (w.instant) return Object.assign(out, { release: true, target: plan.target });
  if (u.facing !== plan.facing) return Object.assign(out, walk(plan.facing)); // a tap turns him
  const err = plan.aim - u.aim;
  if (Math.abs(err) > AIM_TOL) return Object.assign(out, err > 0 ? { aimUp: true } : { aimDown: true });
  if (turn.charging && turn.power >= plan.power - POWER_TOL) out.release = true;
  else out.charge = true;
  return out;
}
