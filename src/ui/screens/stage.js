// The overlay stage: one screen at a time over the canvas, cross-faded, with keyboard focus
// handed to the new screen. A screen is { el, focus?, onKey?(code) -> handled }.
const FADE_MS = 320;

export function createScreens(root) {
  let current = null;
  return {
    show(screen) {
      if (current) {
        const old = current.el;
        old.classList.remove('show');
        old.classList.add('leaving');
        setTimeout(() => old.remove(), FADE_MS);
      }
      current = screen;
      if (!screen) {
        document.activeElement?.blur?.();
        return;
      }
      root.append(screen.el);
      void screen.el.offsetWidth; // commit the start state so the fade-in runs
      screen.el.classList.add('show');
      screen.focus?.focus({ preventScroll: true });
    },
    onKey: (code) => !!current?.onKey?.(code),
  };
}

let toastTimer = 0;
export function toast(message) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
}
