// Title: the glowing BARRAGE logo over the attract-mode battle, and the main menu.
import { h, button, navigate, shell } from './dom.js';
import { play } from '../audio.js';

export function titleScreen(go) {
  const el = shell('title');
  const logo = h('div', 'logo');
  logo.append(h('span', 'logo-glow', 'BARRAGE'), h('span', 'logo-text', 'BARRAGE'), h('span', 'logo-shine', 'BARRAGE'));
  const tag = h('p', 'tagline', 'Destructible-terrain artillery · 15 battlefields');
  const pick = (to) => () => { play('select'); go(to); };
  const items = [
    button('Campaign', pick('campaign'), 'btn btn-big'),
    button('Versus', pick('versus'), 'btn btn-big'),
    button('How to play', pick('howto'), 'btn btn-big'),
  ];
  const menu = h('nav', 'menu', ...items);
  const hint = h('p', 'hint', '↑ ↓ choose · Enter select · M sound');
  el.append(h('div', 'title-stack', logo, tag, menu), hint);
  return { el, focus: items[0], onKey: (code) => navigate(items, code) };
}
