// Round end: who won, a burst of confetti for a victory, and what next.
import { h, button, navigate, shell } from './dom.js';
import { LEVELS } from '../../core/levels.js';

const ARM_MS = 400; // fire-button mashing at the deciding blast must not skip the card
const CONFETTI = ['#ffd24a', '#ff5a8a', '#4ad8ff', '#7dff6a', '#ffffff', '#ff9a2e', '#b78bff'];

function confetti(n = 70) {
  const box = h('div', 'confetti');
  for (let i = 0; i < n; i++) {
    const p = h('i');
    const k = (i * 0.618034) % 1; // golden-ratio spread: even without randomness
    p.style.cssText = `left:${(k * 100).toFixed(1)}%;background:${CONFETTI[i % CONFETTI.length]};` +
      `animation-delay:${((i * 0.37) % 1.6).toFixed(2)}s;animation-duration:${(2.6 + ((i * 0.53) % 1.8)).toFixed(2)}s;` +
      `--drift:${(((i * 37) % 21) - 10) * 9}px;--spin:${360 + ((i * 97) % 540)}deg`;
    box.append(p);
  }
  return box;
}

// outcome: { mode, level, winner (team id | 'draw'), teams } ; act: { next, replay, levels, menu }
export function roundEndScreen(o, act) {
  const shown = performance.now();
  const settled = () => performance.now() - shown >= ARM_MS;
  const go = Object.fromEntries(Object.entries(act).map(([k, fn]) => [k, () => settled() && fn()]));
  const campaign = o.mode === 'campaign';
  const draw = o.winner === 'draw';
  const won = !draw && (!campaign || o.winner === 0);
  const last = o.level.id === LEVELS.length;
  let title;
  if (draw) title = 'Draw!';
  else if (campaign) title = won ? (last ? 'Campaign complete!' : 'Victory!') : 'Defeat';
  else title = `${o.teams[o.winner].name} wins!`;
  const sub = draw ? 'Both teams fell in the same turn.'
    : campaign && won ? (last ? `All ${LEVELS.length} battlefields are yours.` : `Level ${o.level.id + 1} — ${LEVELS[o.level.id].name} unlocked`)
      : campaign ? 'The computer holds the field. Try again?' : o.level.name;
  const el = shell(`roundend dim ${won ? 'won' : 'lost'}`);
  if (won) el.append(confetti());
  const banner = h('div', 'banner', h('h2', 'banner-title', title), h('p', 'sub', sub));
  if (!draw && !campaign) {
    banner.classList.add('team');
    banner.style.setProperty('--team', o.teams[o.winner].color);
  }
  const items = [];
  if (campaign && won && !last) items.push(button('Next level', go.next, 'btn btn-big'));
  items.push(button(!campaign ? 'Rematch' : won ? 'Replay' : 'Retry', go.replay, 'btn btn-big'));
  if (!campaign) items.push(button('Pick level', go.levels, 'btn btn-big'));
  items.push(button('Menu', go.menu, 'btn btn-big'));
  el.append(banner, h('nav', 'menu menu-row', ...items));
  return { el, focus: items[0], onKey: (code) => !settled() || navigate(items, code) };
}
