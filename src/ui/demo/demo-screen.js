// The demo's overlay: a caption panel under the wind gauge (well clear of the soldiers) with
// key caps that light while the game "presses" them, progress dots, and at the end the
// "You're ready" card with the controls. It also plugs the step runner into the match.
import { h, button, navigate, shell } from '../screens/dom.js';
import { howtoCards } from '../screens/howto.js';
import { play } from '../audio.js';
import { setSeenDemo } from '../storage.js';
import { STEPS } from './script.js';
import { createRunner, startStep, skip, replay, pilotFor } from './runner.js';

const KICKER = { show: 'Watch', try: 'Your turn', done: 'Nice!' };
const CODE_KEY = {
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', KeyA: 'A', KeyD: 'D', KeyW: 'W', KeyS: 'S',
  Enter: 'Enter', NumpadEnter: 'Enter', Space: 'Space', KeyQ: 'Q', KeyE: 'E',
  Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5', Digit6: '6',
};

const cap = (label) => {
  const k = h('kbd', 'key', label);
  k.dataset.key = label;
  return k;
};

// "Walk with {←} {→}." -> text with key caps.
function rich(el, text) {
  el.replaceChildren(...text.split(/(\{[^}]+\})/).filter(Boolean)
    .map((part) => (part[0] === '{' ? cap(part.slice(1, -1)) : part)));
  return el;
}

// m: a match on the demo level. act: { campaign, menu } for the last card's buttons.
export function demoScreen(m, act) {
  const runner = createRunner(STEPS, m.fx);
  m.pilot = pilotFor(runner);
  startStep(runner, m.world, 0);
  m.view.hud.key = '0:0'; // the turn never changes hands, so no "Blue team" banner over the caption
  m.world.teams[0].name = 'You';
  m.world.teams[1].name = 'Enemy';

  const el = shell('demo');
  const kicker = h('span', 'demo-kicker');
  const title = h('h2', 'demo-title');
  const dots = h('div', 'demo-dots', ...STEPS.map(() => h('i')));
  const count = h('span', 'demo-count');
  const text = h('p', 'demo-text');
  const foot = rich(h('p', 'demo-foot'), '{H} show me again  ·  {Tab} skip  ·  {Esc} pause');
  const panel = h('div', 'demo-cap card-panel',
    h('div', 'demo-head', h('div', 'demo-name', kicker, title), h('div', 'demo-prog', dots, count)), text, foot);
  el.append(panel);
  let shown = '';
  let lit = '';
  let buttons = null;

  function finale() {
    setSeenDemo();
    el.classList.add('final', 'dim');
    buttons = [button('Start campaign', act.campaign, 'btn btn-big'), button('Back to menu', act.menu, 'btn btn-big')];
    el.append(h('div', 'demo-final',
      h('h2', 'screen-title', STEPS.at(-1).title), h('p', 'sub', STEPS.at(-1).watch),
      howtoCards(), h('nav', 'menu menu-row', ...buttons)));
    buttons[0].focus({ preventScroll: true });
  }

  // Once a frame: redraw the caption when the step or phase changes, light the pressed keys.
  function update(input) {
    const step = STEPS[runner.i];
    const key = `${runner.i}:${runner.phase}`;
    if (key !== shown) {
      if (runner.phase === 'done') play('select');
      if (runner.phase === 'final' && !buttons) finale();
      shown = key;
      const trying = runner.phase !== 'show';
      kicker.textContent = KICKER[runner.phase] || '';
      kicker.className = `demo-kicker ${runner.phase}`;
      title.textContent = step.title;
      rich(text, trying && step.try ? step.try : step.watch);
      count.textContent = `${runner.i + 1} / ${STEPS.length}`;
      [...dots.children].forEach((d, i) => { d.className = i < runner.i ? 'past' : i === runner.i ? 'now' : ''; });
      panel.classList.remove('pop');
      void panel.offsetWidth; // restart the pop-in
      panel.classList.add('pop');
    }
    const keys = runner.phase === 'try' ? [...input.down].map((c) => CODE_KEY[c]).filter(Boolean) : runner.lit;
    const now = keys.join(' ');
    if (now === lit) return;
    lit = now;
    for (const k of text.querySelectorAll('.key')) k.classList.toggle('lit', keys.includes(k.dataset.key));
  }

  function onKey(code, e) {
    if (code === 'Tab') e?.preventDefault(); // focus never wanders off with Tab
    if (buttons) return code === 'Escape' ? (act.menu(), true) : navigate(buttons, code);
    if (code === 'Tab') {
      skip(runner, m.world);
      return true;
    }
    if (code === 'KeyH') return replay(runner, m.world), true;
    return false; // play keys reach the match; Esc pauses it
  }

  // focus: the stage refocuses it when the screen comes back from pause (the final card's button)
  return { el, onKey, update, get focus() { return buttons?.[0] ?? null; } };
}
