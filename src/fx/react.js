// Turns core events into effects. Pure: randomness comes from `rng`, nothing is drawn.
import { addParticle, makeParticle } from './particles.js';
import { addShake, startSlowMo } from './fx.js';

const FALLBACK_FILL = ['#7b5233', '#3b2515'];
const FALLBACK_LIQUID = '#2a8fd6';
const FIRE_COLORS = ['#fff6c8', '#ffd24a', '#ff9a2e', '#ff6a1a'];
const SMOKE_COLORS = ['#3a3a3f', '#55555c', '#6e6e76'];
const DUST = '#c8b89a';
const DEBRIS_BOUNCE = 0.4;
const GRAVE_LIQUID_MARGIN = 4; // a death this close to the liquid surface is a drowning
const LAND_DUST_MIN = 8; // impact px below this raises no dust

const spread = (rng, a, b) => a + (b - a) * rng();
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const count = (n) => Math.max(1, Math.round(n));

function spark(fx, rng, x, y, speed) {
  const a = rng() * Math.PI * 2;
  const v = spread(rng, speed * 0.3, speed);
  addParticle(fx, makeParticle({
    x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.2, life: spread(rng, 0.3, 0.8),
    size: spread(rng, 1.5, 3), grow: -2, color: pick(rng, FIRE_COLORS), kind: 'spark',
    gravity: 300, drag: 1.5, additive: true,
  }));
}

function smoke(fx, rng, x, y, spreadPx, size) {
  addParticle(fx, makeParticle({
    x: x + spread(rng, -spreadPx, spreadPx), y: y + spread(rng, -spreadPx, spreadPx) * 0.5,
    vx: spread(rng, -20, 20), vy: spread(rng, -50, -15), life: spread(rng, 0.8, 1.6),
    size, grow: size * 1.2, color: pick(rng, SMOKE_COLORS), kind: 'smoke', gravity: -25, drag: 1,
  }));
}

function dust(fx, rng, x, y, n) {
  for (let i = 0; i < n; i++) {
    addParticle(fx, makeParticle({
      x: x + spread(rng, -8, 8), y, vx: spread(rng, -45, 45), vy: spread(rng, -40, -5),
      life: spread(rng, 0.3, 0.6), size: spread(rng, 2, 4), grow: 8, color: DUST, kind: 'dust',
      gravity: 20, drag: 3,
    }));
  }
}

function explosion(fx, ev, rng, level) {
  const { x, y, r } = ev;
  const fill = level?.fill ?? FALLBACK_FILL;
  fx.flashes.push({ x, y, r: r * 2.2, life: 0.18, max: 0.18 });
  fx.rings.push({ x, y, r: 0, maxR: r * 1.8, life: 0.5, max: 0.5, color: '#ffe9b0' });
  addShake(fx, Math.min(30, r * 0.25));
  for (let i = 0; i < count(r / 3); i++) {
    const a = spread(rng, Math.PI, Math.PI * 2); // upward fan
    const v = spread(rng, 120, 120 + r * 5);
    addParticle(fx, makeParticle({
      x: x + spread(rng, -r, r) * 0.3, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: spread(rng, 0.8, 1.6), size: spread(rng, 2, 5), color: pick(rng, fill), kind: 'debris',
      gravity: 900, drag: 0.3, bounce: DEBRIS_BOUNCE,
    }));
  }
  for (let i = 0; i < count(r / 8); i++) smoke(fx, rng, x, y, r * 0.5, spread(rng, 8, 14) + r * 0.1);
  for (let i = 0; i < count(r / 3); i++) spark(fx, rng, x, y, 250 + r * 3);
}

function death(fx, ev, rng, level) {
  if (ev.decisive) startSlowMo(fx); // the kill that decides the match, while it still flies
  const drowned = level?.liquid && ev.y >= level.liquid.y - GRAVE_LIQUID_MARGIN;
  if (!drowned) fx.graves.push({ x: ev.x, y: ev.y });
  for (let i = 0; i < 24; i++) spark(fx, rng, ev.x, ev.y - 10, 260);
  for (let i = 0; i < 6; i++) {
    addParticle(fx, makeParticle({
      x: ev.x, y: ev.y - 10, vx: spread(rng, -60, 60), vy: spread(rng, -200, -80),
      life: spread(rng, 1, 1.8), size: 2.5, grow: -1, color: '#ffb14a', kind: 'ember',
      gravity: 200, drag: 0.8, additive: true,
    }));
  }
}

function splash(fx, ev, rng, level) {
  const color = level?.liquid?.color ?? FALLBACK_LIQUID;
  for (let i = 0; i < 20; i++) {
    addParticle(fx, makeParticle({
      x: ev.x + spread(rng, -6, 6), y: ev.y, vx: spread(rng, -90, 90), vy: spread(rng, -380, -140),
      life: spread(rng, 0.5, 0.9), size: spread(rng, 2, 4), grow: -1.5, color, kind: 'splash',
      gravity: 900, drag: 0.2,
    }));
  }
}

function fire(fx, ev, rng) {
  fx.flashes.push({ x: ev.x, y: ev.y, r: 40, life: 0.08, max: 0.08 });
  for (let i = 0; i < 5; i++) smoke(fx, rng, ev.x, ev.y, 4, spread(rng, 4, 7));
  for (let i = 0; i < 6; i++) spark(fx, rng, ev.x, ev.y, 180);
}

function unitPos(world, id) {
  for (const t of world?.teams ?? []) for (const u of t.units) if (u.id === id) return u;
  return null;
}

// world is optional: land and jump carry only a unit id, so they need it for a position.
export function applyEvent(fx, ev, rng, level, world) {
  switch (ev.type) {
    case 'explosion': explosion(fx, ev, rng, level); break;
    case 'damage':
      fx.floaters.push({
        x: ev.x, y: ev.y - 20, vy: -45, text: '-' + Math.round(ev.amount), color: '#ffe14a',
        life: 1.4, max: 1.4,
      });
      break;
    case 'death': death(fx, ev, rng, level); break;
    case 'splash': splash(fx, ev, rng, level); break;
    case 'fire': fire(fx, ev, rng); break;
    case 'bounce': dust(fx, rng, ev.x, ev.y, 5); break;
    case 'land': {
      const u = ev.impact >= LAND_DUST_MIN ? unitPos(world, ev.unit) : null;
      if (u) dust(fx, rng, u.x, u.y, count(ev.impact / 6));
      break;
    }
    case 'jump': {
      const u = unitPos(world, ev.unit);
      if (u) dust(fx, rng, u.x, u.y, 4);
      break;
    }
    default: break;
  }
}
