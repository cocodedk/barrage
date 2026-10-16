// Level select, for the campaign map and versus setup: fifteen cards with a preview of each
// battlefield, locked ones greyed with a padlock. Arrow keys move over the 5 x 3 grid.
import { LEVELS } from '../../core/levels.js';
import { isOpen, unlockedLevel } from '../storage.js';
import { play } from '../audio.js';
import { h, button, focusItem, navigate, shell, lockIcon } from './dom.js';
import { levelThumb } from './thumbs.js';

const COLS = 5;
const COPY = {
  campaign: ['Campaign', 'Beat each battlefield to unlock the next.'],
  versus: ['Versus', 'Two players, one keyboard. Pick a battlefield.'],
};

function card(level, mode, start) {
  const open = isOpen(level.id, mode);
  const beaten = level.id < unlockedLevel();
  const art = h('div', 'level-art', levelThumb(level));
  if (!open) art.append(lockIcon());
  if (beaten && mode === 'campaign') art.append(h('span', 'level-done', '✓'));
  const c = button(art, () => {
    if (open) {
      play('select');
      start(level);
      return;
    }
    play('denied');
    c.classList.remove('shake');
    void c.offsetWidth; // restart the shake animation
    c.classList.add('shake');
  }, `level-card${open ? '' : ' locked'}`);
  c.style.setProperty('--edge', level.edge);
  c.append(h('div', 'level-meta', h('span', 'level-num', String(level.id)), h('span', 'level-name', level.name)));
  return c;
}

export function levelsScreen(mode, start, back) {
  const [title, sub] = COPY[mode];
  const el = shell(`levels levels-${mode}`, title);
  const cards = LEVELS.map((l) => card(l, mode, start));
  const grid = h('div', 'level-grid', ...cards);
  const backBtn = button('Back', back, 'btn');
  el.append(h('p', 'sub', sub), grid, h('div', 'row', backBtn, h('span', 'hint', 'Arrows move · Enter play · Esc back')));
  const latest = Math.min(unlockedLevel(), LEVELS.length);
  const first = mode === 'campaign' ? cards[latest - 1] : cards[0];
  const items = [...cards, backBtn];
  return {
    el, focus: first,
    onKey(code) {
      if (code === 'Escape') return back(), true;
      if (document.activeElement === backBtn && (code === 'ArrowUp' || code === 'KeyW')) {
        focusItem(cards[cards.length - 1]);
        return true;
      }
      return navigate(items, code, COLS);
    },
  };
}
