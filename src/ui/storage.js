// Saved progress: the highest unlocked campaign level and the mute switch. Every localStorage
// touch is wrapped: private windows, kiosks and blocked storage just play without saving.
import { LEVELS } from '../core/levels.js';

const KEY = 'barrage.v1';
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
  return Number.isFinite(n) ? Math.max(1, Math.min(LEVELS.length + 1, n)) : 1;
}

export function unlockLevel(n) {
  if (n > unlockedLevel()) save({ unlocked: Math.min(LEVELS.length + 1, n) });
}

export const isMuted = () => !!load().muted;
export const setMuted = (muted) => save({ muted: !!muted });

// Campaign: play any level up to the unlocked one. Versus: 1-3 always, plus every beaten level.
export function isOpen(levelId, mode) {
  const u = unlockedLevel();
  return mode === 'versus' ? levelId <= 3 || levelId < u : levelId <= u;
}
