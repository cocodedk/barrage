// Soldiers, their HP labels, gravestones, and the active soldier's marker, reticle and aim
// line. Squash and flinch come from a small visual state per unit id, fed by what changed
// since the last frame (landing, losing hp).
import { INK_SOFT, POWER_COLORS, rgba, shade, glow, roundRect } from './sprites.js';
import { drawSoldier, drawGrave } from './soldier.js';
import { aimDir, aimDegrees, weaponById, MISSILE_OFFSETS } from '../core/weapons.js';
import { activeUnit } from '../core/turns.js';

const RETICLE = 92;

function visual(v, u, dt) {
  let s = v.unitFx.get(u.id);
  if (!s) {
    s = { vy: 0, ground: u.onGround, hp: u.hp, squash: 0, flinch: 0, walk: 0, walking: false, sx: 1, sy: 1 };
    v.unitFx.set(u.id, s);
  }
  if (!s.ground && u.onGround) s.squash = Math.min(1, 0.3 + Math.abs(s.vy) / 450);
  if (u.hp < s.hp) s.flinch = 1;
  s.vy = u.vy;
  s.ground = u.onGround;
  s.hp = u.hp;
  s.squash = Math.max(0, s.squash - dt * 4);
  s.flinch = Math.max(0, s.flinch - dt * 3.5);
  s.walking = u.onGround && Math.abs(u.vx) > 5;
  if (s.walking) s.walk += dt * 16;
  const q = s.squash * Math.cos((1 - s.squash) * Math.PI * 1.5);
  const stretch = !u.onGround && u.vy < -80 ? 0.1 : 0;
  s.sy = 1 - 0.32 * q + stretch;
  s.sx = 1 + 0.26 * q - stretch * 0.8;
  return s;
}

// A dark rounded tag centred on (x, y): the HP labels and the aim angle.
function tag(ctx, x, y, text, rim, ink) {
  ctx.font = 'bold 15px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 12;
  roundRect(ctx, x - w / 2, y - 10, w, 19, 9);
  ctx.fillStyle = 'rgba(10,12,20,0.66)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rim;
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.fillText(text, x, y + 0.5);
}

function label(ctx, u, color) {
  tag(ctx, u.x, u.y - 46, String(Math.ceil(u.hp)), rgba(color, 0.9), shade(color, 0.45));
}

// The aim angle: a horizon tick, an arc from it to the aim line, and the degrees past the reticle.
function angle(ctx, u, cx, cy, dx, dy) {
  const from = u.facing > 0 ? 0 : Math.PI;
  const side = Math.cos(from);
  for (const [w, s] of [[3.5, 'rgba(10,12,20,0.45)'], [1.5, 'rgba(255,255,255,0.7)']]) {
    ctx.lineWidth = w;
    ctx.strokeStyle = s;
    ctx.beginPath();
    ctx.moveTo(cx + side * 54, cy);
    ctx.arc(cx, cy, 44, from, from - u.facing * u.aim, u.facing * u.aim > 0);
    ctx.stroke();
  }
  const d = RETICLE + 38;
  tag(ctx, cx + dx * d, cy + dy * d, `${aimDegrees(u)}°`, 'rgba(255,255,255,0.9)', '#ffffff');
}

function marker(ctx, u, color, t) {
  const y = u.y - 72 + Math.sin(t * 5) * 5;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.6;
  ctx.drawImage(glow(color), u.x - 22, y - 22, 44, 44);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.moveTo(u.x - 10, y - 8);
  ctx.lineTo(u.x + 10, y - 8);
  ctx.lineTo(u.x, y + 6);
  ctx.closePath();
  ctx.fillStyle = shade(color, 0.2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
}

function aim(ctx, u, turn, t) {
  const { x: dx, y: dy } = aimDir(u);
  const cx = u.x;
  const cy = u.y - 12;
  const charging = turn.charging;
  angle(ctx, u, cx, cy, dx, dy);
  for (let d = 26; d < RETICLE - 10; d += 9) {
    const f = (d - 26) / (RETICLE - 36);
    const lit = charging && f <= turn.power;
    ctx.fillStyle = lit ? POWER_COLORS[f < 0.45 ? 0 : f < 0.8 ? 1 : 2] : `rgba(255,255,255,${0.85 - f * 0.4})`;
    const r = lit ? 3.4 : 2;
    ctx.beginPath();
    ctx.arc(cx + dx * d, cy + dy * d, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const rx = cx + dx * RETICLE;
  const ry = cy + dy * RETICLE;
  const spin = t * 1.5;
  for (const [w, c] of [[4.5, INK_SOFT], [2, '#ffffff']]) {
    ctx.lineWidth = w;
    ctx.strokeStyle = c;
    ctx.beginPath();
    ctx.arc(rx, ry, 10, 0, Math.PI * 2);
    for (let k = 0; k < 4; k++) {
      const a = spin + (k * Math.PI) / 2;
      ctx.moveTo(rx + Math.cos(a) * 6, ry + Math.sin(a) * 6);
      ctx.lineTo(rx + Math.cos(a) * 15, ry + Math.sin(a) * 15);
    }
    ctx.stroke();
  }
  ctx.fillStyle = '#ff4a4a';
  ctx.fillRect(rx - 1.5, ry - 1.5, 3, 3);
}

// Airstrike target: a dashed drop line from the sky, the five drop points, a glowing ring.
function target(ctx, c, color, t) {
  ctx.setLineDash([12, 9]);
  ctx.lineDashOffset = -t * 40;
  for (const [w, s] of [[5, 'rgba(10,12,20,0.45)'], [2.5, rgba(shade(color, 0.3), 0.95)]]) {
    ctx.lineWidth = w;
    ctx.strokeStyle = s;
    ctx.beginPath();
    ctx.moveTo(c.x, 0);
    ctx.lineTo(c.x, c.y - 22);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const o of MISSILE_OFFSETS) {
    const x = c.x + o;
    ctx.fillStyle = INK_SOFT;
    ctx.fillRect(x - 4, c.y - 4, 8, 8);
    ctx.fillStyle = shade(color, 0.5);
    ctx.fillRect(x - 2.5, c.y - 2.5, 5, 5);
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 6);
  ctx.drawImage(glow(color), c.x - 34, c.y - 34, 68, 68);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  const r = 18 + Math.sin(t * 6) * 2;
  for (const [w, s] of [[5.5, INK_SOFT], [3, shade(color, 0.3)]]) {
    ctx.lineWidth = w;
    ctx.strokeStyle = s;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.moveTo(c.x - r - 7, c.y);
    ctx.lineTo(c.x - r + 5, c.y);
    ctx.moveTo(c.x + r - 5, c.y);
    ctx.lineTo(c.x + r + 7, c.y);
    ctx.stroke();
  }
}

export function drawUnits(ctx, v, world, fx, t, dt) {
  for (const g of fx.graves) drawGrave(ctx, g.x, g.y);
  const turn = world.turn;
  const active = activeUnit(world);
  const color = world.teams[turn.team].color;
  const showAim = active.alive && turn.phase === 'aim';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const team of world.teams) {
    for (const u of team.units) {
      const s = visual(v, u, dt);
      if (!u.alive) continue;
      drawSoldier(ctx, u, team.color, s, u === active && showAim ? turn.weapon : null);
    }
  }
  for (const team of world.teams) for (const u of team.units) if (u.alive) label(ctx, u, team.color);
  const strike = weaponById(turn.weapon).target;
  if (showAim && !strike) aim(ctx, active, turn, t);
  if (showAim && strike && v.cursor) target(ctx, v.cursor, color, t);
  if (active.alive && (showAim || turn.phase === 'retreat')) {
    marker(ctx, active, shade(color, 0.1), t);
  }
}
