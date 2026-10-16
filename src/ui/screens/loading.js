// The brief card shown while a level's terrain and art are baked: "Level 7 — Candy Land".
import { h, shell } from './dom.js';

export function loadingScreen(level, modeLabel) {
  const el = shell('loading');
  el.style.background = `linear-gradient(180deg, ${level.sky.map(([s, c]) => `${c} ${s * 100}%`).join(', ')})`;
  el.append(h('div', 'loading-card',
    h('p', 'loading-kicker', `${modeLabel} · Level ${level.id}`),
    h('h2', 'loading-name', level.name),
    h('div', 'loading-bar', h('span'))));
  return { el, onKey: () => true };
}
