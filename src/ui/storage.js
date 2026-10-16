// Saved progress: the highest unlocked campaign level, the mute switch and whether the demo was seen. Every localStorage
// touch is wrapped: private windows, kiosks and blocked storage just play without saving.
import { LEVELS } from '../core/levels.js';
import { clamp } from '../core/math.js';

const KEY = 'barrage.v1';
const TOP = LEVELS.length + 1; // one past the last level: the campaign is beaten
const DEFAULTS = { unlocked: 1, muted: false };
let memory = { ...DEFAULTS }; // the truth when localStorage is unavailable

function load() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) memory = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // unreadable or corrupt: keep what is in memory
  }
  return memory;
}

function save(patch) {
  memory = { ...load(), ...patch };
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(memory));
  } catch {
    // full or blocked: the in-memory copy still holds for this session
  }
}

// 1..LEVELS.length + 1 (one past the last means the whole campaign is beaten).
export function unlockedLevel() {
  const n = Math.floor(Number(load().unlocked));
  return Number.isFinite(n) ? clamp(n, 1, TOP) : 1;
}

export function unlockLevel(n) {
  if (n > unlockedLevel()) save({ unlocked: Math.min(TOP, n) });
}

export const isMuted = () => !!load().muted;
export const seenDemo = () => !!load().seenDemo;
export const setSeenDemo = () => save({ seenDemo: true });
export const setMuted = (muted) => save({ muted: !!muted });

// Campaign: play any level up to the unlocked one. Versus: 1-3 always, plus every beaten level.
export function isOpen(levelId, mode) {
  const u = unlockedLevel();
  return mode === 'versus' ? levelId <= 3 || levelId < u : levelId <= u;
}
