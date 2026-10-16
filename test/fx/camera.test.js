import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCamera, stepCamera, MAX_ZOOM } from '../../src/fx/camera.js';

const run = (cam, focus, secs) => { for (let i = 0; i < secs * 60; i++) stepCamera(cam, focus, 1 / 60); };

test('starts centred at zoom 1', () => {
  assert.deepEqual(createCamera(), { x: 960, y: 540, zoom: 1 });
});

test('zoom eases toward 1.3 with a focus and never exceeds it', () => {
  const cam = createCamera();
  stepCamera(cam, { x: 400, y: 300 }, 1 / 60);
  assert.ok(cam.zoom > 1 && cam.zoom < 1.3);
  run(cam, { x: 400, y: 300 }, 4);
  assert.ok(cam.zoom > 1.29 && cam.zoom <= MAX_ZOOM);
  assert.equal(MAX_ZOOM, 1.3);
});

test('zoom and centre ease back when the focus goes away', () => {
  const cam = createCamera();
  run(cam, { x: 200, y: 200 }, 4);
  assert.ok(cam.x < 960);
  run(cam, null, 6);
  assert.ok(Math.abs(cam.zoom - 1) < 0.01);
  assert.ok(Math.abs(cam.x - 960) < 1 && Math.abs(cam.y - 540) < 1);
});

test('the view never leaves the world', () => {
  const cam = createCamera();
  run(cam, { x: 0, y: 0 }, 6);
  assert.ok(cam.x - 960 / cam.zoom >= -0.5);
  assert.ok(cam.y - 540 / cam.zoom >= -0.5);
  run(cam, { x: 1920, y: 1080 }, 6);
  assert.ok(cam.x + 960 / cam.zoom <= 1920.5);
  assert.ok(cam.y + 540 / cam.zoom <= 1080.5);
});
