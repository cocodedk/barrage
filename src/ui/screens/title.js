// Title: the glowing BARRAGE logo over the attract-mode battle, and the main menu.
// fresh: nobody has seen the demo yet, so "How to play" is highlighted and focused.
import { h, button, navigate, shell } from './dom.js';
import { play } from '../audio.js';

export function titleScreen(go, fresh = false) {
  const el = shell('title');
  const logo = h('div', 'logo');
  logo.append(h('span', 'logo-glow', 'BARRAGE'), h('span', 'logo-text', 'BARRAGE'), h('span', 'logo-shine', 'BARRAGE'));
  const tag = h('p', 'tagline', 'Destructible-terrain artillery · 15 battlefields');
  const pick = (to) => () => { play('select'); go(to); };
  const howto = button('How to play', pick('howto'), fresh ? 'btn btn-big btn-new' : 'btn btn-big');
  const items = [button('Campaign', pick('campaign'), 'btn btn-big'), button('Versus', pick('versus'), 'btn btn-big'), howto];
  const menu = h('nav', 'menu', items[0], items[1], fresh ? h('p', 'new-badge', 'New here? Start with the demo') : null, howto);
  const hint = h('p', 'hint', '↑ ↓ choose · Enter select · M sound');
  el.append(h('div', 'title-stack', logo, tag, menu), hint);
  return { el, focus: fresh ? howto : items[0], onKey: (code) => navigate(items, code) };
}
