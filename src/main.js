// Barrage: boot, the frame loop and screen routing. Logic runs in fixed steps inside game.js;
// this file decides what is on screen (attract battle, menus, a match) and moves between them.
import { LEVELS } from './core/levels.js';
import { createInput, resetInput } from './ui/input.js';
import { unlockAudio, toggleMute, play } from './ui/audio.js';
import { unlockedLevel, seenDemo, setSeenDemo } from './ui/storage.js';
import { createMatch, stepMatch, drawMatch, forceWin, replayAttract } from './ui/game.js';
import { createDebug } from './ui/debug.js';
import { createScreens, toast } from './ui/screens/stage.js';
import { titleScreen } from './ui/screens/title.js';
import { levelsScreen } from './ui/screens/levels.js';
import { pauseScreen } from './ui/screens/pause.js';
import { loadingScreen } from './ui/screens/loading.js';
import { roundEndScreen } from './ui/screens/roundend.js';
import { demoScreen } from './ui/demo/demo-screen.js';
import { DEMO_SEED } from './ui/demo/scene.js';

const ROUND_END_DELAY = 2.2; // s after the deciding blast before the round-end card
const MIN_LOADING = 0.7; // s the level card stays up, so it reads as a moment, not a flicker

const canvas = document.getElementById('game');
const stage = createScreens(document.getElementById('ui'));
const input = createInput(canvas);
input.onGesture = unlockAudio;
const app = { state: 'title', match: null, attract: null, demo: null, loadToken: 0 };

const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const randomLevel = () => LEVELS[seed() % LEVELS.length];

// The title's backdrop battle: one random level, baked once while the title fades in. It is
// kept through menus and matches, so coming back to the title never bakes again.
function startAttract() {
  if (app.attract || app.match || app.state === 'loading') return; // kept, or a level is on its way
  app.attract = createMatch(canvas, randomLevel(), 'campaign', seed(), { attract: true });
}

function goTitle() {
  app.state = 'title';
  app.match = null;
  app.demo = null;
  stage.show(titleScreen((to) => (to === 'howto' ? goHowto() : goLevels(to)), !seenDemo()));
  if (!app.attract) requestAnimationFrame(() => requestAnimationFrame(startAttract)); // paint the menu first
}
const goHowto = () => startLevel(LEVELS[0], 'demo'); // How to play is the watch-then-try demo
const goLevels = (mode) => {
  app.state = 'menu';
  stage.show(levelsScreen(mode, (level) => startLevel(level, mode), goTitle));
};

// The demo leaves for the title or the campaign; either way it counts as seen.
function leaveDemo(to) {
  setSeenDemo();
  if (to === 'campaign') startLevel(LEVELS[Math.min(unlockedLevel(), LEVELS.length) - 1], 'campaign');
  else goTitle();
}

// mode: 'campaign', 'versus' or 'demo' (Green Meadow on a fixed seed, run by the demo script).
function startLevel(level, mode) {
  const token = ++app.loadToken;
  const demo = mode === 'demo';
  app.state = 'loading';
  app.match = null;
  app.demo = null;
  stage.show(loadingScreen(level, demo ? 'How to play' : mode === 'campaign' ? 'Campaign' : 'Versus'));
  const t0 = performance.now();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (token !== app.loadToken) return;
    const match = createMatch(canvas, level, demo ? 'versus' : mode, demo ? DEMO_SEED : seed());
    const wait = Math.max(0, MIN_LOADING * 1000 - (performance.now() - t0));
    setTimeout(() => {
      if (token !== app.loadToken) return;
      app.match = match;
      app.state = demo ? 'demo' : 'playing';
      resetInput(input);
      if (demo) app.demo = demoScreen(match, { campaign: () => leaveDemo('campaign'), menu: () => leaveDemo('title') });
      stage.show(app.demo);
    }, wait);
  }));
}

function pause() {
  const m = app.match;
  const was = app.state; // 'playing' or 'demo'
  app.state = 'paused';
  resetInput(input); // a charge in progress is dropped, not fired
  play('menu');
  stage.show(pauseScreen({
    levelName: app.demo ? 'How to play' : `Level ${m.level.id} — ${m.level.name}`,
    resume: () => { app.state = was; resetInput(input); stage.show(app.demo); },
    restart: () => (app.demo ? goHowto() : startLevel(m.level, m.mode)),
    quit: () => (app.demo ? leaveDemo('title') : goTitle()),
  }));
}
const live = () => app.state === 'playing' || app.state === 'demo';

function endRound(m) {
  const { winner } = m.world;
  app.state = 'roundend';
  stage.show(roundEndScreen({ mode: m.mode, level: m.level, winner, teams: m.world.teams }, {
    next: () => startLevel(LEVELS[m.level.id], m.mode),
    replay: () => startLevel(m.level, m.mode),
    levels: () => goLevels(m.mode),
    menu: goTitle,
  }));
}

input.onKey = (code, e) => {
  if (code === 'KeyM') return toast(toggleMute() ? 'Sound off' : 'Sound on');
  if (stage.onKey(code, e)) return undefined;
  if (live() && code === 'Escape') pause();
  return undefined;
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden && live()) pause();
});

const debug = createDebug({
  winRound(team = 0) {
    if (app.match && app.state === 'playing') forceWin(app.match, team);
  },
  info: () => {
    const w = (app.match || app.attract)?.world;
    return {
      state: app.state, unlocked: unlockedLevel(), level: w?.level.id, winner: w?.winner ?? null,
      turn: w && { team: w.turn.team, phase: w.turn.phase, weapon: w.turn.weapon, power: w.turn.power },
      demo: app.match?.pilot && { step: app.match.pilot.runner.i + 1, phase: app.match.pilot.runner.phase },
    };
  },
});

function frame(dt, t) {
  if (app.attract && !app.match) {
    const a = app.attract;
    if (a.world.winner != null && a.overTime > 3) replayAttract(a); // same level: no bake
  }
  const m = app.match || app.attract;
  if (!m) return;
  const t0 = performance.now();
  if (app.state !== 'paused') stepMatch(m, dt, live() ? input : null);
  if (app.state === 'demo') app.demo.update(input);
  const t1 = performance.now();
  drawMatch(m, dt, t);
  debug?.sample(dt * 1000, t1 - t0, performance.now() - t1);
  if (m === app.match && app.state === 'playing' && m.world.winner != null && m.overTime > ROUND_END_DELAY) endRound(m);
}

let last = null;
function loop(now) {
  const t = now / 1000;
  const dt = last == null ? 0 : Math.min(0.1, t - last); // a tab switch is not a 10 s step
  last = t;
  frame(dt, t);
  requestAnimationFrame(loop);
}

goTitle();
requestAnimationFrame(loop);
