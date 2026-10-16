// Soldiers, their HP labels, gravestones, and the active soldier's marker, reticle and aim
// line. Squash and flinch come from a small visual state per unit id, fed by what changed
// since the last frame (landing, losing hp).
import { rgba, mix, shade, glow, roundRect } from './sprites.js';
import { drawSoldier, drawGrave } from './soldier.js';

const RETICLE = 92;
const POWER = ['#5aff7a', '#ffe14a', '#ff4a3a'];

function visual(v, u, dt) {
  let s = v.unitFx.get(u.id);
  if (!s) {
    s = { vy: 0, ground: u.onGround, hp: u.hp, squash: 0, flinch: 0, walk: 0, sx: 1, sy: 1 };
    v.unitFx.set(u.id, s);
  }
  if (!s.ground && u.onGround) s.squash = Math.min(1, 0.3 + Math.abs(s.vy) / 450);
  if (u.hp < s.hp) s.flinch = 1;
  s.vy = u.vy;
  s.ground = u.onGround;
  s.hp = u.hp;
  s.squash = Math.max(0, s.squash - dt * 4);
  s.flinch = Math.max(0, s.flinch - dt * 3.5);
  const moving = u.onGround && Math.abs(u.vx) > 5;
  s.walk = moving ? s.walk + dt * 16 : null;
  const q = s.squash * Math.cos((1 - s.squash) * Math.PI * 1.5);
  const stretch = !u.onGround && u.vy < -80 ? 0.1 : 0;
  s.sy = 1 - 0.32 * q + stretch;
  s.sx = 1 + 0.26 * q - stretch * 0.8;
  return s;
}

function label(ctx, u, color) {
  const text = String(Math.ceil(u.hp));
  ctx.font = 'bold 15px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 12;
  const y = u.y - 46;
  roundRect(ctx, u.x - w / 2, y - 10, w, 19, 9);
  ctx.fillStyle = 'rgba(10,12,20,0.66)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(color, 0.9);
  ctx.stroke();
  ctx.fillStyle = mix(color, '#ffffff', 0.45);
  ctx.fillText(text, u.x, y + 0.5);
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
  ctx.fillStyle = mix(color, '#ffffff', 0.2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
}

function aim(ctx, u, turn, t) {
  const dx = u.facing * Math.cos(u.aim);
  const dy = -Math.sin(u.aim);
  const cx = u.x;
  const cy = u.y - 12;
  const charging = turn.charging;
  for (let d = 26; d < RETICLE - 10; d += 9) {
    const f = (d - 26) / (RETICLE - 36);
    const lit = charging && f <= turn.power;
    ctx.fillStyle = lit ? POWER[f < 0.45 ? 0 : f < 0.8 ? 1 : 2] : `rgba(255,255,255,${0.85 - f * 0.4})`;
    const r = lit ? 3.4 : 2;
    ctx.beginPath();
    ctx.arc(cx + dx * d, cy + dy * d, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const rx = cx + dx * RETICLE;
  const ry = cy + dy * RETICLE;
  const spin = t * 1.5;
  for (const [w, c] of [[4.5, 'rgba(10,12,20,0.7)'], [2, '#ffffff']]) {
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

export function drawUnits(ctx, v, world, fx, t, dt) {
  for (const g of fx.graves) drawGrave(ctx, g.x, g.y);
  const turn = world.turn;
  const active = world.teams[turn.team]?.units[turn.unit];
  const showAim = active?.alive && turn.phase === 'aim';
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
  if (showAim && turn.weapon !== 'airstrike') aim(ctx, active, turn, t);
  if (active?.alive && (showAim || turn.phase === 'retreat')) {
    marker(ctx, active, shade(world.teams[turn.team].color, 0.1), t);
  }
}
