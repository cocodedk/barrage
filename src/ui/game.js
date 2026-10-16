// One match: the world, its renderer and effects, and the fixed-step logic that drives it.
// Logic runs in 1/60 s ticks from an accumulator; each tick's dt is scaled by fx.timeScale
// (slow motion). Events drain every tick into fx, audio and the terrain canvas.
import { createWorld, stepWorld } from '../core/world.js';
import { endMatch } from '../core/turns.js';
import { aiPlan, aiIntents } from '../core/ai.js';
import { inFlight } from '../core/weapons.js';
import { makeRng } from '../core/rng.js';
import { createFx, stepFx } from '../fx/fx.js';
import { applyEvent } from '../fx/react.js';
import { createCamera, stepCamera } from '../fx/camera.js';
import { createView, drawFrame, replayTerrain } from './view.js';
import { play, soundForEvent } from './audio.js';
import { createControls, humanIntents, resetControls } from './controls.js';
import { endTick } from './input.js';
import { unlockLevel } from './storage.js';

export const STEP = 1 / 60;
const MAX_STEPS = 6; // per frame; beyond this the game slows instead of spiralling
const ATTRACT_SKILL = 0.75;

// opts.attract: AI vs AI with no HUD and no sound (the title screen's backdrop).
// m.pilot (set by the demo) supplies every tick's intents in place of the AI or the player.
export function createMatch(canvas, level, mode, seed, opts = {}) {
  const m = {
    level, mode, seed, attract: !!opts.attract, rng: makeRng(seed),
    fxRng: makeRng(seed ^ 0x9e3779b9), // effects draw from their own stream
    controls: createControls(), pilot: null, replays: 0,
  };
  freshRun(m, m.rng);
  m.view = createView(canvas, level, m.world, m.attract);
  m.view.showHud = !m.attract;
  drain(m); // createWorld already announced the first turn
  return m;
}

// A new battle on the match's level: world (the computer on both sides of an attract match),
// effects, camera and the AI's plan, all fresh.
function freshRun(m, worldRng) {
  m.world = createWorld(m.level, m.mode, worldRng);
  if (m.attract) for (const t of m.world.teams) t.ai = { skill: ATTRACT_SKILL };
  Object.assign(m, { fx: createFx(), cam: createCamera(), ai: { plan: null, elapsed: 0 }, acc: 0, overTime: 0 });
}

// The title battle is over: fight it again on the same battlefield. The same seed grows the
// same ground, so the view restores its kept bake rather than baking again; a fresh rng makes
// it a new battle.
export function replayAttract(m) {
  freshRun(m, makeRng(m.seed));
  m.rng = makeRng(m.seed + ++m.replays);
  replayTerrain(m.view);
  drain(m);
}

function drain(m) {
  const { world } = m;
  for (const ev of world.events) {
    applyEvent(m.fx, ev, m.fxRng, world.level, world);
    if (ev.type === 'crater') m.view.onCrater(ev.x, ev.y, ev.r);
    if (ev.type === 'turn') {
      m.ai.plan = null;
      resetControls(m.controls); // the next airstrike marker starts at the new soldier
    }
    if (m.attract) continue;
    if (ev.type === 'win' && m.mode === 'campaign' && ev.winner === 0) unlockLevel(m.level.id + 1); // saved now, not when the card shows
    if (ev.type === 'win') play(m.mode === 'campaign' && ev.winner !== 0 ? 'lose' : 'win'); // computer won: no fanfare
    else soundForEvent(ev);
  }
  world.events.length = 0;
}

// The computer's intents: plan once when its aim phase starts, then play the plan out.
function aiTick(m, dt) {
  const { world, ai } = m;
  const phase = world.turn.phase;
  if (phase === 'aim' && !ai.plan) {
    ai.plan = aiPlan(world, m.rng);
    ai.elapsed = 0;
  }
  if (!ai.plan || (phase !== 'aim' && phase !== 'retreat')) return {};
  ai.elapsed += dt;
  return aiIntents(ai.plan, ai.elapsed, world);
}

function tick(m, input, dt) {
  const { world } = m;
  let intents = {};
  if (world.winner == null) {
    if (m.pilot) intents = m.pilot.intents(m, input, dt); // the demo: its script, or the player
    else if (world.teams[world.turn.team].ai) intents = aiTick(m, dt);
    else if (input) intents = humanIntents(m.controls, input, world, m.view, m.cam, dt);
  }
  m.view.cursor = intents.marker ?? null; // the airstrike target, while one is being aimed
  if (input) endTick(input);
  stepWorld(world, dt, intents, m.rng);
  m.pilot?.after(m, dt); // sees this tick's events before they drain
  drain(m);
}

// Advance by one real frame. input is null when nobody may play (attract mode, pause).
export function stepMatch(m, realDt, input) {
  m.acc += realDt;
  let n = 0;
  while (m.acc >= STEP && n < MAX_STEPS) {
    tick(m, input, STEP * m.fx.timeScale);
    m.acc -= STEP;
    n++;
  }
  if (n === MAX_STEPS) m.acc = 0;
  stepFx(m.fx, realDt, m.world.terrain);
  if (m.world.winner != null) m.overTime += realDt;
  return n;
}

export function drawMatch(m, realDt, t) {
  stepCamera(m.cam, m.world.projectiles.find(inFlight) || null, realDt); // not planted dynamite
  drawFrame(m.view, m.world, m.fx, m.cam, t);
}

// Debug: end the round now with `team` as the winner.
export function forceWin(m, team) {
  const { world } = m;
  if (world.winner != null) return;
  for (const u of world.teams[1 - team].units) {
    u.hp = 0;
    u.alive = false;
  }
  world.projectiles.length = 0;
  endMatch(world, team);
  drain(m);
}
