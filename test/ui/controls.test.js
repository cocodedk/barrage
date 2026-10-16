import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepWorld } from '../../src/core/world.js';
import { makeRng } from '../../src/core/rng.js';
import { createControls, humanIntents } from '../../src/ui/controls.js';
import { newInputState, endTick, resetInput, cancelPointer } from '../../src/ui/input.js';
import { flatWorld, eventsOf, DT } from '../core/helpers.js';

// One logic tick the way game.js runs it: read intents, forget edges, step the world.
function setup() {
  const s = { w: flatWorld(), c: createControls(), input: newInputState(), rng: makeRng(3) };
  s.tick = (n = 1) => {
    let out;
    for (let i = 0; i < n; i++) {
      out = humanIntents(s.c, s.input, s.w, {}, null, DT);
      endTick(s.input);
      stepWorld(s.w, DT, out, s.rng);
    }
    return out;
  };
  s.press = () => { s.input.down.add('Space'); s.input.pressed.add('Space'); };
  s.lift = () => { s.input.down.delete('Space'); s.input.released.add('Space'); };
  return s;
}

test('a short tap of Space fires exactly once', () => {
  const s = setup();
  s.press();
  s.lift(); // down and up inside one frame
  s.tick();
  assert.equal(eventsOf(s.w, 'fire').length, 1);
  s.tick(20);
  assert.equal(eventsOf(s.w, 'fire').length, 1);
});

test('Space held over from an earlier turn neither charges nor fires', () => {
  const s = setup();
  s.input.down.add('Space'); // held, but pressed before this aim phase began
  s.tick(30);
  assert.deepEqual([s.w.turn.charging, s.w.turn.power], [false, 0]);
  s.lift();
  s.tick();
  assert.equal(eventsOf(s.w, 'fire').length, 0);
  assert.equal(s.w.turn.phase, 'aim');
});

test('a release after the aim phase has ended does not fire into the next turn', () => {
  const s = setup();
  s.press();
  s.tick(10);
  assert.equal(s.w.turn.charging, true);
  s.w.turn.timeLeft = DT / 2; // the clock runs out mid-charge
  s.tick(3);
  assert.equal(s.w.turn.team, 1); // hot-seat: the other player is now aiming
  s.lift();
  const out = s.tick();
  assert.ok(!out.release);
  assert.equal(eventsOf(s.w, 'fire').length, 0);
});

test('pausing mid-charge drops the charge; the next tap starts from zero', () => {
  const s = setup();
  s.press();
  s.tick(40);
  assert.ok(s.w.turn.power > 0.5);
  resetInput(s.input); // pause
  s.lift(); // let go while the pause menu is up
  resetInput(s.input); // resume
  s.tick();
  assert.deepEqual([s.w.turn.charging, s.w.turn.power, s.w.turn.phase], [false, 0, 'aim']);
  assert.equal(eventsOf(s.w, 'fire').length, 0);
  s.press();
  s.lift();
  s.tick();
  assert.equal(eventsOf(s.w, 'fire').length, 1);
  assert.ok(s.w.turn.power < 0.1, `fired from ${s.w.turn.power}, not the old charge`);
});

test('a key still held through a pause keeps walking but must be re-pressed to fire', () => {
  const s = setup();
  s.input.down.add('ArrowRight');
  s.press();
  s.tick(5);
  resetInput(s.input); // pause
  resetInput(s.input); // resume
  assert.ok(s.tick().cancel);
  const next = s.tick();
  assert.equal(next.right, true);
  assert.ok(!next.charge);
});

test('a cancelled mouse press drops its charge; the next press starts from zero', () => {
  const s = setup();
  const m = s.input.mouse;
  Object.assign(m, { down: true, pressed: true });
  s.tick(40);
  assert.ok(s.w.turn.charging && s.w.turn.power > 0.5);
  cancelPointer(s.input); // e.g. a touch turned into a scroll
  s.tick();
  assert.deepEqual([s.w.turn.charging, s.w.turn.power, s.w.turn.phase], [false, 0, 'aim']);
  s.press(); // Space now: a fresh charge, not the old one carried on
  s.tick(5);
  s.lift();
  s.tick();
  assert.equal(eventsOf(s.w, 'fire').length, 1);
  assert.ok(s.w.turn.power < 0.2, `fired from ${s.w.turn.power}, not the stale charge`);
});

test('a stray pointercancel with the mouse button up leaves a keyboard charge alone', () => {
  const s = setup();
  s.press();
  s.tick(30);
  const power = s.w.turn.power;
  cancelPointer(s.input);
  s.tick();
  assert.ok(s.w.turn.charging && s.w.turn.power > power);
});
