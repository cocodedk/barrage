// Barrage: boot, the frame loop and screen routing. Logic runs in fixed steps inside game.js;
// this file decides what is on screen (attract battle, menus, a match) and moves between them.
import { LEVELS } from './core/levels.js';
import { createInput, resetInput } from './ui/input.js';
import { unlockAudio, toggleMute, play } from './ui/audio.js';
import { unlockLevel, unlockedLevel } from './ui/storage.js';
import { createMatch, stepMatch, drawMatch, forceWin } from './ui/game.js';
import { createDebug } from './ui/debug.js';
import { createScreens, toast } from './ui/screens/stage.js';
import { titleScreen } from './ui/screens/title.js';
import { levelsScreen } from './ui/screens/levels.js';
import { howtoScreen } from './ui/screens/howto.js';
import { pauseScreen } from './ui/screens/pause.js';
import { loadingScreen } from './ui/screens/loading.js';
import { roundEndScreen } from './ui/screens/roundend.js';

const ROUND_END_DELAY = 2.2; // s after the deciding blast before the round-end card
const ATTRACT_MAX = 150; // s before the title battle moves to another level
const MIN_LOADING = 0.7; // s the level card stays up, so it reads as a moment, not a flicker

const canvas = document.getElementById('game');
const stage = createScreens(document.getElementById('ui'));
const input = createInput(canvas);
input.onGesture = unlockAudio;
const app = { state: 'title', match: null, attract: null, loadToken: 0 };

const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const randomLevel = () => LEVELS[seed() % LEVELS.length];

function startAttract() {
  if (app.match || app.state === 'loading') return; // a level is on its way: no backdrop needed
  app.attract = createMatch(canvas, randomLevel(), 'campaign', seed(), { attract: true });
}

function goTitle() {
  app.state = 'title';
  app.match = null;
  stage.show(titleScreen((to) => (to === 'howto' ? goHowto() : goLevels(to))));
  if (!app.attract) requestAnimationFrame(() => requestAnimationFrame(startAttract)); // paint the menu first
}
const goHowto = () => stage.show(howtoScreen(goTitle));
const goLevels = (mode) => {
  app.state = 'menu';
  stage.show(levelsScreen(mode, (level) => startLevel(level, mode), goTitle));
};

function startLevel(level, mode) {
  const token = ++app.loadToken;
  app.state = 'loading';
  app.match = null;
  app.attract = null;
  stage.show(loadingScreen(level, mode === 'campaign' ? 'Campaign' : 'Versus'));
  const t0 = performance.now();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (token !== app.loadToken) return;
    const match = createMatch(canvas, level, mode, seed());
    const wait = Math.max(0, MIN_LOADING * 1000 - (performance.now() - t0));
    setTimeout(() => {
      if (token !== app.loadToken) return;
      app.match = match;
      app.state = 'playing';
      resetInput(input);
      stage.show(null);
    }, wait);
  }));
}

function pause() {
  const m = app.match;
  app.state = 'paused';
  play('menu');
  stage.show(pauseScreen({
    levelName: `Level ${m.level.id} — ${m.level.name}`,
    resume: () => { app.state = 'playing'; resetInput(input); stage.show(null); },
    restart: () => startLevel(m.level, m.mode),
    quit: goTitle,
  }));
}

function endRound(m) {
  const { winner } = m.world;
  const campaign = m.mode === 'campaign';
  if (campaign && winner === 0) unlockLevel(m.level.id + 1);
  app.state = 'roundend';
  stage.show(roundEndScreen({ mode: m.mode, level: m.level, winner, teams: m.world.teams }, {
    next: () => startLevel(LEVELS[m.level.id], m.mode),
    replay: () => startLevel(m.level, m.mode),
    levels: () => goLevels(m.mode),
    menu: goTitle,
  }));
}

input.onKey = (code) => {
  if (code === 'KeyM') return toast(toggleMute() ? 'Sound off' : 'Sound on');
  if (stage.onKey(code)) return undefined;
  if (app.state === 'playing' && code === 'Escape') pause();
  return undefined;
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden && app.state === 'playing') pause();
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
    };
  },
});

function frame(dt, t) {
  if (app.attract && !app.match) {
    const a = app.attract;
    if ((a.world.winner != null && a.overTime > 3) || a.time > ATTRACT_MAX) startAttract();
  }
  const m = app.match || app.attract;
  if (!m) return;
  const t0 = performance.now();
  if (app.state !== 'paused') stepMatch(m, dt, app.state === 'playing' ? input : null);
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
