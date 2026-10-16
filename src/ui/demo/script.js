// The demo, step by step. Each step is first played by the game ("watch"), then, where it has a
// check, done by the player ("try"). Text marks key caps as {key}.
//   setup(world)               set the scene when the step starts (and on "show me again")
//   show(t, world, state)      the scripted intents at t seconds into the show; null when done.
//                              Extra fields: press (a key cap to light), marker (airstrike x)
//   ready(world, state)        when the try begins: note where things stand
//   check(world, events, state) -> true once the player has done it (events: this tick's)
import { aiIntents, THINK_TIME } from '../../core/ai-intents.js';
import { DEG } from '../../core/math.js';
import { hero, arrange, planShot, digPit, pitShove } from './scene.js';

const STRONG_WIND = 150; // px/s^2: the HUD arrow turns red
const hold = (secs, intents = {}) => (t) => (t < secs ? intents : null);
const fired = (events, weapon) => events.some((e) => e.type === 'fire' && e.weapon === weapon);

// Keys pressed one after another: [[from s, to s, intents], ...]; done after `end` s.
const keys = (end, beats) => (t) => {
  if (t >= end) return null;
  const beat = beats.find(([a, b]) => t >= a && t < b);
  return beat ? { ...beat[2] } : {};
};

// Play a planned shot the way the computer does: think (lighting `press`), face, aim, charge, fire.
const shot = (plan, press) => (t, world, s) => {
  if (world.turn.shotsFired > 0) return null;
  s.plan ??= plan(world);
  const out = aiIntents(s.plan, t, world);
  if (t < THINK_TIME && press) Object.assign(out, { weapon: s.plan.weapon, press });
  return out;
};

// Airstrike: pick it with 4, slide the marker over the middle enemy, call it in with Space.
function airstrike(t, world, s) {
  if (world.turn.shotsFired > 0) return null;
  const u = hero(world);
  s.from ??= u.x + u.facing * 320;
  s.to ??= world.teams[1].units.find((v) => v.alive && Math.abs(v.x - u.x) > 200)?.x ?? s.from;
  if (t < 0.5) return {};
  if (t < 0.9) return { weapon: 3, press: '4' };
  const k = Math.min(1, (t - 1.1) / 1.2);
  const marker = s.from + (s.to - s.from) * Math.max(0, k);
  if (t < 2.6) return { marker, press: s.to > s.from ? '→' : '←' };
  return { marker, release: true, target: { x: marker }, press: 'Space' };
}

export const STEPS = [
  {
    id: 'welcome', title: 'Welcome to Barrage',
    watch: 'Two teams of three soldiers. Knock out the other team to win!',
    setup: arrange, show: hold(4.5),
  },
  {
    id: 'turns', title: 'Taking turns', clock: true,
    watch: 'One soldier acts per turn, with 30 seconds on the clock. The glowing panel shows whose turn it is.',
    show: hold(5.5),
  },
  {
    id: 'walk', title: 'Walk',
    watch: 'Walk with {←} {→} or {A} {D}.',
    try: 'Walk a few steps with {←} {→} or {A} {D}.',
    show: hold(1, { right: true }),
    ready: (world, s) => { s.x = hero(world).x; },
    check: (world, events, s) => Math.abs(hero(world).x - s.x) >= 40,
  },
  {
    id: 'jump', title: 'Jump',
    watch: 'Press {Enter} to jump over bumps.',
    try: 'Jump with {Enter}.',
    show: keys(2.2, [[0.4, 0.7, { jump: true }]]),
    check: (world, events) => events.some((e) => e.type === 'jump' && e.unit === hero(world).id),
  },
  {
    id: 'aim', title: 'Aim',
    watch: 'Raise and lower your aim with {↑} {↓} or {W} {S}. The mouse works too.',
    try: 'Move your aim with {↑} {↓}, {W} {S} or the mouse.',
    setup: (world) => { hero(world).aim = 0.5; },
    show: keys(1.6, [[0.2, 0.65, { aimUp: true }], [0.9, 1.2, { aimDown: true }]]),
    ready: (world, s) => { s.aim = hero(world).aim; },
    check: (world, events, s) => Math.abs(hero(world).aim - s.aim) >= 20 * DEG,
  },
  {
    id: 'fire', title: 'Charge and fire',
    watch: 'Hold {Space} to charge — the bar shows your power. Let go to fire.',
    try: 'Hold {Space}, then let go to fire the bazooka.',
    setup: (world) => { world.turn.weapon = 'bazooka'; },
    show: shot((world) => planShot(world, 'bazooka')),
    check: (world, events) => fired(events, 'bazooka'),
  },
  {
    id: 'wind', title: 'Wind',
    watch: 'The arrow at the top is the wind. Rockets drift with it — grenades don’t.',
    setup: (world) => { world.wind = STRONG_WIND; world.turn.weapon = 'bazooka'; },
    show: shot((world) => ({ weapon: 'bazooka', moveSteps: 0, facing: 1, x: hero(world).x, aim: 72 * DEG, power: 0.62 })),
  },
  {
    id: 'blast', title: 'Blasts',
    watch: 'Explosions dig craters, hurt anyone close and knock them flying.',
    show: shot((world) => planShot(world, 'bazooka')),
  },
  {
    id: 'weapons', title: 'Weapons',
    watch: 'Switch weapons with {Q} {E} or {1} – {6}.',
    try: 'Pick the grenade: press {2}.',
    setup: (world) => { world.turn.weapon = 'bazooka'; },
    show: keys(3.2, [[0.5, 0.85, { weapon: 1, press: 'E' }], [1.3, 1.65, { weapon: 2, press: 'E' }],
      [2.1, 2.45, { weapon: 1, press: 'Q' }]]),
    ready: (world) => { world.turn.weapon = 'bazooka'; },
    check: (world) => world.turn.weapon === 'grenade',
  },
  {
    id: 'grenade', title: 'Grenade',
    watch: 'Grenades bounce, ignore the wind and go off after 3 seconds.',
    try: 'Throw the grenade: hold {Space}, let go.',
    show: shot((world) => planShot(world, 'grenade'), '2'),
    ready: (world) => { world.turn.weapon = 'grenade'; },
    check: (world, events) => fired(events, 'grenade'),
  },
  {
    id: 'airstrike', title: 'Airstrike',
    watch: 'Press {4}, move the marker with {←} {→} or the mouse, then {Space}.',
    try: 'Call in an airstrike: aim the marker, press {Space}.',
    show: airstrike,
    ready: (world) => { world.turn.weapon = 'airstrike'; },
    check: (world, events) => fired(events, 'airstrike'),
  },
  {
    id: 'hazards', title: 'Watch your step',
    watch: 'Long falls hurt, and water is deadly — one splash and you’re out.',
    setup: (world) => { world.turn.weapon = 'bazooka'; digPit(world); },
    show: shot((world) => planShot(world, 'bazooka', pitShove(world))),
  },
  {
    id: 'ready', title: 'You’re ready!', final: true,
    watch: 'Knock out all three enemy soldiers to win the round. Good luck!',
  },
];
