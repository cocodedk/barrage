import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unlockedLevel, unlockLevel, isOpen, isMuted, setMuted, seenDemo, setSeenDemo } from '../../src/ui/storage.js';

// Node has no localStorage, so this exercises the in-memory fallback first.
test('progress works without localStorage', () => {
  assert.equal(unlockedLevel(), 1);
  assert.ok(isOpen(1, 'campaign'));
  assert.ok(!isOpen(2, 'campaign'));
  unlockLevel(2);
  assert.equal(unlockedLevel(), 2);
  unlockLevel(1); // never goes backwards
  assert.equal(unlockedLevel(), 2);
  setMuted(true);
  assert.ok(isMuted());
  setMuted(false);
});

test('versus opens levels 1-3 plus every level beaten in the campaign', () => {
  unlockLevel(5); // levels 1-4 beaten
  const open = [];
  for (let id = 1; id <= 15; id++) if (isOpen(id, 'versus')) open.push(id);
  assert.deepEqual(open, [1, 2, 3, 4]);
  unlockLevel(99); // capped at one past the last level: the whole campaign beaten
  assert.equal(unlockedLevel(), 16);
  assert.ok(isOpen(15, 'versus'));
});

test('a throwing localStorage is survived and saves persist through a working one', () => {
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
  assert.equal(unlockedLevel(), 16); // memory copy still answers
  setMuted(true);
  assert.ok(isMuted());
  const store = {};
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  setMuted(false);
  assert.deepEqual(JSON.parse(store['barrage.v1']), { unlocked: 16, muted: false });
  store['barrage.v1'] = '{not json';
  assert.equal(unlockedLevel(), 16); // corrupt data falls back to memory
  delete globalThis.localStorage;
});

test('the demo counts as unseen until it is finished or left, and that is remembered', () => {
  const store = {};
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  assert.equal(seenDemo(), false);
  setSeenDemo();
  assert.equal(seenDemo(), true);
  assert.equal(JSON.parse(store['barrage.v1']).seenDemo, true);
  delete globalThis.localStorage;
});
