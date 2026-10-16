// The mouse charge must never stick: a press that starts on the canvas is released even when the
// button comes up outside the window.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../../src/ui/input.js';

// createInput listens on the global scope (window) and on the canvas; stub both.
function rig() {
  const on = {};
  const onCanvas = {};
  const captured = [];
  globalThis.addEventListener = (type, fn) => ((on[type] ||= []).push(fn));
  const canvas = {
    addEventListener: (type, fn) => ((onCanvas[type] ||= []).push(fn)),
    setPointerCapture: (id) => captured.push(id),
  };
  const input = createInput(canvas);
  delete globalThis.addEventListener;
  const fire = (where, type, e) => (where[type] || []).forEach((fn) => fn({ preventDefault() {}, ...e }));
  return { input, captured, win: (type, e) => fire(on, type, e), canvas: (type, e) => fire(onCanvas, type, e) };
}

const press = { button: 0, buttons: 1, pointerId: 7, clientX: 100, clientY: 200 };

test('a press on the canvas captures the pointer, so its pointerup arrives wherever it happens', () => {
  const r = rig();
  r.canvas('pointerdown', press);
  assert.deepEqual(r.captured, [7]);
  assert.equal(r.input.mouse.down, true);
  r.win('pointerup', { ...press, buttons: 0 });
  assert.deepEqual([r.input.mouse.down, r.input.mouse.released], [false, true]);
});

test('if the pointerup was lost anyway, the next move with no button held releases the charge', () => {
  const r = rig();
  r.canvas('pointerdown', press);
  r.win('pointermove', { ...press, buttons: 0, clientX: 300 });
  assert.deepEqual([r.input.mouse.down, r.input.mouse.released], [false, true]);
  r.win('pointermove', { ...press, buttons: 1, clientX: 320 });
  assert.equal(r.input.mouse.down, false, 'a move never presses');
});
