// Tiny DOM helpers shared by the screens: element building, focusable buttons, and arrow-key
// navigation over a list or grid that keeps mouse hover and keyboard focus in step.
import { play } from '../audio.js';

export function h(tag, cls, ...kids) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  for (const k of kids) if (k != null) el.append(k);
  return el;
}

export function button(label, onPick, cls = 'btn') {
  const b = h('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', () => onPick());
  b.addEventListener('pointerenter', () => b !== document.activeElement && focusItem(b));
  return b;
}

export function focusItem(el) {
  if (!el) return;
  el.focus({ preventScroll: true });
  play('menu');
}

// Move focus among `items` (elements in reading order) with the arrows; `cols` > 1 is a grid.
// A plain list (cols 1) wraps around and takes left/right as well, for menus laid out in a row.
// Enter / Space pick the focused item. Returns true when the key was handled.
export function navigate(items, code, cols = 1) {
  const i = items.indexOf(document.activeElement);
  const step = { ArrowUp: -cols, ArrowDown: cols, KeyW: -cols, KeyS: cols, ArrowLeft: -1, ArrowRight: 1, KeyA: -1, KeyD: 1 };
  if (code in step) {
    if (i < 0) return focusItem(items[0]), true; // focus went astray: start over at the top
    let j = i + step[code];
    if (cols === 1) j = (j + items.length) % items.length;
    if (j >= 0 && j < items.length) focusItem(items[j]);
    return true;
  }
  if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
    const el = items.includes(document.activeElement) ? document.activeElement : items[0];
    el.click();
    return true;
  }
  return false;
}

// A labelled screen shell: <section class="screen {cls}"> with an optional heading.
export function shell(cls, title) {
  const el = h('section', `screen ${cls}`);
  if (title) el.append(h('h2', 'screen-title', title));
  return el;
}

const LOCK_SVG = '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke-width="2.4"/></svg>';

export function lockIcon() {
  const span = h('span', 'lock-wrap');
  span.innerHTML = LOCK_SVG; // the HTML parser puts it in the SVG namespace by itself
  return span;
}
