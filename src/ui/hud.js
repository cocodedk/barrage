// Heads-up display in the logical 1920 x 1080 frame, sized to read from across a room:
// team HP panels, turn timer, wind, weapon bar (keys 1-6), power meter, turn banner.
import { W, H, INK, POWER_COLORS, rgba, shade, roundRect } from './sprites.js';
import { WEAPONS, weaponById } from '../core/weapons.js';
import { MAX_HP } from '../core/units.js';
import { canSwitchWeapon } from '../core/turns.js';
import { clamp } from '../core/math.js';
import { drawIcon } from './hud-icons.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const COLOR_NAMES = ['Blue', 'Red'];
const WIND_FULL = 180; // px/s^2 that fills the wind gauge
const BANNER_IN = 0.45;
const BANNER_HOLD = 2.1;
const BANNER_OUT = 0.45;
const fills = new Map(); // gradients with fixed geometry, built once rather than every frame

function fill(key, make) {
  let gr = fills.get(key);
  if (!gr) fills.set(key, (gr = make()));
  return gr;
}

function panel(ctx, x, y, w, h, border = 'rgba(255,255,255,0.16)', r = 16) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = 'rgba(8,10,18,0.64)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = border;
  ctx.stroke();
}

function text(ctx, s, x, y, size, color, align = 'left', weight = 800) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function teamPanel(ctx, team, active, right) {
  const w = 470;
  const x = right ? W - 32 - w : 32;
  const hp = team.units.reduce((s, u) => s + (u.alive ? u.hp : 0), 0);
  const max = team.units.length * MAX_HP;
  panel(ctx, x, 26, w, 92, active ? rgba(team.color, 0.95) : undefined);
  const side = right ? 'right' : 'left';
  const edge = right ? x + w - 22 : x + 22;
  text(ctx, team.name, edge, 58, 28, '#ffffff', side, 900);
  text(ctx, String(Math.ceil(hp)), right ? x + 22 : x + w - 22, 58, 28, shade(team.color, 0.4), right ? 'left' : 'right', 900);
  const nameW = ctx.measureText(team.name).width;
  team.units.forEach((u, i) => {
    ctx.beginPath();
    const px = right ? x + w - 22 - nameW - 26 - i * 20 : x + 22 + nameW + 26 + i * 20;
    ctx.arc(px, 49, 7, 0, Math.PI * 2);
    ctx.fillStyle = u.alive ? team.color : 'rgba(255,255,255,0.18)';
    ctx.fill();
  });
  const bx = x + 22;
  const bw = w - 44;
  roundRect(ctx, bx, 80, bw, 20, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();
  const fw = Math.max(0, (bw * hp) / max);
  if (fw > 4) {
    roundRect(ctx, right ? bx + bw - fw : bx, 80, fw, 20, 10);
    ctx.fillStyle = fill(`hp ${team.color}`, () => {
      const gr = ctx.createLinearGradient(0, 80, 0, 100);
      gr.addColorStop(0, shade(team.color, 0.45));
      gr.addColorStop(1, team.color);
      return gr;
    });
    ctx.fill();
  }
}

function timer(ctx, turn, t) {
  const secs = Math.max(0, Math.ceil(turn.timeLeft));
  const urgent = turn.phase === 'aim' && turn.timeLeft < 5;
  const pulse = urgent ? 1 + 0.14 * Math.abs(Math.sin(t * Math.PI * 2)) : 1;
  panel(ctx, W / 2 - 74, 22, 148, 92, urgent ? 'rgba(255,74,74,0.9)' : undefined, 20);
  ctx.save();
  ctx.translate(W / 2, 70);
  ctx.scale(pulse, pulse);
  const label = turn.phase === 'aim' || turn.phase === 'retreat' || turn.phase === 'flying' ? String(secs) : '–';
  const color = urgent ? '#ff4a4a' : turn.phase === 'aim' ? '#ffffff' : '#ffcf5a';
  text(ctx, label, 0, 2, 58, color, 'center', 900);
  ctx.restore();
}

function wind(ctx, world) {
  const x = W / 2 - 160;
  panel(ctx, x, 124, 320, 48, undefined, 14);
  text(ctx, 'WIND', x + 18, 149, 16, 'rgba(255,255,255,0.7)', 'left', 800);
  const k = clamp(world.wind / WIND_FULL, -1, 1);
  const cx = x + 200;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(cx - 100, 147, 200, 3);
  ctx.fillRect(cx - 1, 138, 2, 22);
  if (Math.abs(world.wind) < 1) {
    text(ctx, 'CALM', cx, 149, 18, '#bfe8ff', 'center', 900);
    return;
  }
  const len = Math.max(14, Math.abs(k) * 100);
  const dir = Math.sign(k);
  const color = Math.abs(k) < 0.35 ? '#7ff6ff' : Math.abs(k) < 0.7 ? '#ffd24a' : '#ff5a3a';
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, 143);
  ctx.lineTo(cx + dir * (len - 12), 143);
  ctx.lineTo(cx + dir * (len - 12), 136);
  ctx.lineTo(cx + dir * len, 148.5);
  ctx.lineTo(cx + dir * (len - 12), 161);
  ctx.lineTo(cx + dir * (len - 12), 154);
  ctx.lineTo(cx, 154);
  ctx.fill();
}

function weaponBar(ctx, world, color) {
  const turn = world.turn;
  const size = 86;
  const gap = 12;
  const x0 = W / 2 - (WEAPONS.length * size + (WEAPONS.length - 1) * gap) / 2;
  const y = H - 26 - size;
  WEAPONS.forEach((w, i) => {
    const sel = w.id === turn.weapon;
    const locked = !sel && !canSwitchWeapon(turn);
    const x = x0 + i * (size + gap);
    const yy = sel ? y - 8 : y;
    panel(ctx, x, yy, size, size, sel ? color : undefined, 16);
    if (sel) {
      roundRect(ctx, x, yy, size, size, 16);
      ctx.fillStyle = rgba(color, 0.28);
      ctx.fill();
    }
    ctx.globalAlpha = locked ? 0.35 : 1;
    drawIcon(ctx, w.id, x + size / 2, yy + size / 2 + 4, 58);
    text(ctx, String(i + 1), x + 12, yy + 20, 18, sel ? '#ffffff' : 'rgba(255,255,255,0.6)', 'left', 900);
    ctx.globalAlpha = 1;
  });
  const cur = weaponById(turn.weapon);
  if (!turn.charging) {
    const shots = turn.shotsLeft > 1 ? `  ×${turn.shotsLeft}` : '';
    text(ctx, cur.name + shots, W / 2, y - 34, 26, '#ffffff', 'center', 900);
  }
  if (turn.charging) {
    const bw = 560;
    const bx = W / 2 - bw / 2;
    panel(ctx, bx - 6, y - 58, bw + 12, 38, undefined, 12);
    ctx.fillStyle = fill('power', () => {
      const gr = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      gr.addColorStop(0, POWER_COLORS[0]);
      gr.addColorStop(0.55, POWER_COLORS[1]);
      gr.addColorStop(1, POWER_COLORS[2]);
      return gr;
    });
    roundRect(ctx, bx, y - 52, Math.max(12, bw * turn.power), 26, 9);
    ctx.fill();
    text(ctx, `${Math.round(turn.power * 100)}%`, W / 2, y - 39, 20, INK, 'center', 900);
  }
}

const ease = (u) => 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2; // ease-out with a little overshoot

function banner(ctx, world, hud, t) {
  const age = t - hud.t0;
  const total = BANNER_IN + BANNER_HOLD + BANNER_OUT;
  if (age < 0 || age > total) return;
  const team = world.teams[world.turn.team];
  const y = -60 + ease(Math.min(1, age / BANNER_IN)) * 330;
  ctx.globalAlpha = age > total - BANNER_OUT ? (total - age) / BANNER_OUT : 1;
  const main = `${COLOR_NAMES[team.id]} team — Soldier ${world.turn.unit + 1}`;
  ctx.font = `900 50px ${FONT}`;
  const w = ctx.measureText(main).width + 120;
  panel(ctx, W / 2 - w / 2, y - 56, w, 112, rgba(team.color, 0.95), 24);
  ctx.fillStyle = team.color;
  ctx.fillRect(W / 2 - w / 2 + 24, y - 56, w - 48, 6);
  text(ctx, main, W / 2, y - 8, 50, '#ffffff', 'center', 900);
  text(ctx, team.name.toUpperCase(), W / 2, y + 34, 20, shade(team.color, 0.45), 'center', 800);
  ctx.globalAlpha = 1;
}

// hud: the view's HUD state { key, t0 } (banner timing).
export function drawHud(ctx, world, hud, t) {
  const turn = world.turn;
  const key = `${turn.team}:${turn.unit}`;
  if (key !== hud.key) {
    hud.key = key;
    hud.t0 = t;
  }
  ctx.textBaseline = 'middle';
  world.teams.forEach((team, i) => {
    teamPanel(ctx, team, turn.team === i && world.winner == null, i === 1);
  });
  timer(ctx, turn, t);
  wind(ctx, world);
  weaponBar(ctx, world, world.teams[turn.team].color);
  banner(ctx, world, hud, t);
}
