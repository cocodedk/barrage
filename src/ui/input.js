// Raw keyboard and mouse state. Held keys live in `down`; `pressed`/`released` collect edges until
// the next logic tick consumes them (endTick), so a tap shorter than a frame is never lost.
// Keys with Alt (or Ctrl/Meta) held are left alone: Alt+Left must stay the browser's Back.
const GAME_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'NumpadEnter', 'Escape',
]);

export function createInput(canvas) {
  const input = {
    down: new Set(), pressed: new Set(), released: new Set(),
    mouse: { x: 0, y: 0, seen: false, moved: false, down: false, pressed: false, released: false },
    onKey: null, // (code, event) => void, for screens and global keys
    onGesture: null, // first-gesture hook (audio unlock)
  };

  const gesture = () => input.onGesture?.();

  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    gesture();
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    input.down.add(e.code);
    input.pressed.add(e.code);
    input.onKey?.(e.code, e);
  });
  addEventListener('keyup', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault(); // no native button click on Space-up
    if (!input.down.has(e.code)) return;
    input.down.delete(e.code);
    input.released.add(e.code);
  });
  addEventListener('blur', () => {
    for (const code of input.down) input.released.add(code);
    input.down.clear();
    if (input.mouse.down) input.mouse.released = true;
    input.mouse.down = false;
  });

  const m = input.mouse;
  addEventListener('pointermove', (e) => {
    m.x = e.clientX;
    m.y = e.clientY;
    m.seen = true;
    m.moved = true;
  });
  canvas.addEventListener('pointerdown', (e) => {
    gesture();
    if (e.button !== 0) return;
    Object.assign(m, { x: e.clientX, y: e.clientY, seen: true, moved: true, down: true, pressed: true });
  });
  addEventListener('pointerup', (e) => {
    if (e.button !== 0 || !m.down) return;
    m.down = false;
    m.released = true;
  });
  addEventListener('pointerdown', gesture);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return input;
}

// Forget edges after a logic tick has read them.
export function endTick(input) {
  input.pressed.clear();
  input.released.clear();
  input.mouse.moved = false;
  input.mouse.pressed = false;
  input.mouse.released = false;
}

// Drop everything held, e.g. when a menu takes over, so no key leaks into the next match.
export function resetInput(input) {
  input.down.clear();
  input.mouse.down = false;
  endTick(input);
}
