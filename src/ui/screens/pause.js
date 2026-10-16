// Pause: Resume / Restart / Quit to menu. Esc resumes.
import { h, button, navigate, shell } from './dom.js';

export function pauseScreen({ resume, restart, quit, levelName }) {
  const el = shell('pause dim', 'Paused');
  const items = [button('Resume', resume, 'btn btn-big'), button('Restart', restart, 'btn btn-big'), button('Quit to menu', quit, 'btn btn-big')];
  el.append(h('p', 'sub', levelName), h('nav', 'menu', ...items));
  return {
    el, focus: items[0],
    onKey: (code) => (code === 'Escape' ? (resume(), true) : navigate(items, code)),
  };
}
