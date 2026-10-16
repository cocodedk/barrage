// The human player's intents for one logic tick, from keys and mouse (same keys for both
// players in hot-seat versus). An airstrike's target comes back as `marker` for the renderer.
import { WEAPONS, weaponById } from '../core/weapons.js';
import { activeUnit } from '../core/turns.js';
import { AIM_LIMIT } from '../core/units.js';
import { bodyCentre } from '../core/explode.js';
import { clamp } from '../core/math.js';
import { WORLD_W as W, WORLD_H as H } from '../core/terrain-gen.js';

const MARKER_SPEED = 720; // px/s, keyboard airstrike target
const KEYS = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'], jump: ['Enter', 'NumpadEnter'], fire: ['Space'],
};
const DIGITS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
const clampX = (x) => clamp(x, 20, W - 20); // the marker stays clear of the world's edges

// armed: a fire press began during this aim phase (so a held key never fires into a new turn).
export const createControls = () => ({ armed: false, markerX: null });

// A new turn or a scripted stretch: no armed press, and the next marker starts at the soldier.
export function resetControls(c) {
  c.armed = false;
  c.markerX = null;
}

// Client (CSS px) -> world coordinates, through the view's letterbox fit and the camera.
function toWorld(view, cam, clientX, clientY) {
  const c = view.canvas;
  const rect = c.getBoundingClientRect();
  if (!rect.width || !rect.height || !view.fit?.s) return null;
  const bx = ((clientX - rect.left) * c.width) / rect.width;
  const by = ((clientY - rect.top) * c.height) / rect.height;
  const sx = (bx - view.fit.ox) / view.fit.s;
  const sy = (by - view.fit.oy) / view.fit.s;
  return { x: (sx - W / 2) / cam.zoom + cam.x, y: (sy - H / 2) / cam.zoom + cam.y };
}

function pickWeapon(input, turn) {
  const digit = DIGITS.findIndex((d) => input.pressed.has(d));
  if (digit >= 0) return digit;
  const step = (input.pressed.has('KeyE') ? 1 : 0) - (input.pressed.has('KeyQ') ? 1 : 0);
  if (!step) return undefined;
  const i = WEAPONS.findIndex((w) => w.id === turn.weapon);
  return (i + step + WEAPONS.length) % WEAPONS.length;
}

function mouseAim(u, at) {
  const dx = at.x - u.x;
  const dy = bodyCentre(u).y - at.y;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
  if (Math.abs(dx) >= 1) u.facing = Math.sign(dx);
  u.aim = clamp(Math.atan2(dy, Math.abs(dx)), -AIM_LIMIT, AIM_LIMIT);
}

export function humanIntents(c, input, world, view, cam, dt) {
  const turn = world.turn;
  const u = activeUnit(world);
  const held = (k) => KEYS[k].some((code) => input.down.has(code));
  const hit = (k) => KEYS[k].some((code) => input.pressed.has(code));
  const lifted = (k) => KEYS[k].some((code) => input.released.has(code));
  const m = input.mouse;
  const aiming = turn.phase === 'aim' && u.alive;
  if (!aiming) c.armed = false;
  const out = {};
  if (aiming) out.weapon = pickWeapon(input, turn);
  const w = weaponById(turn.weapon);
  const strike = aiming && w.target;
  const at = m.seen && (strike || m.moved) ? toWorld(view, cam, m.x, m.y) : null; // only read when used

  if (strike) {
    if (c.markerX == null) c.markerX = clampX(u.x + u.facing * 320);
    if (m.moved && at) c.markerX = clampX(at.x);
    c.markerX = clampX(c.markerX + ((held('right') ? 1 : 0) - (held('left') ? 1 : 0)) * MARKER_SPEED * dt);
    const y = at && Math.abs(at.x - c.markerX) < 1 ? at.y : world.terrain.surfaceY(Math.round(c.markerX));
    out.marker = { x: c.markerX, y: clamp(y, 0, H) };
  } else {
    c.markerX = null;
    out.left = held('left');
    out.right = held('right');
  }
  out.jump = hit('jump');
  out.aimUp = held('up');
  out.aimDown = held('down');
  if (aiming && !strike && m.moved && at) mouseAim(u, at);

  if (input.cancelled) { // paused or unfocused mid-charge: drop it; firing needs a fresh press
    c.armed = false;
    out.cancel = true;
    return out;
  }
  if (aiming && (hit('fire') || m.pressed)) c.armed = true;
  const firing = held('fire') || m.down;
  if (c.armed && (firing || hit('fire') || m.pressed) && !w.instant) out.charge = true; // a tap is a weak shot
  if (c.armed && (lifted('fire') || m.released) && !firing) {
    out.release = true;
    c.armed = false;
    if (strike) out.target = { x: c.markerX };
  }
  return out;
}
