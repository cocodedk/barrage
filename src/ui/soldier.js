// One soldier, drawn around his feet: boots, team-coloured body, face, helmet and the
// selected weapon held along the aim. Also the gravestone a dead soldier leaves.
import { shade, mix, roundRect } from './sprites.js';

const SKIN = '#f2c89a';
const INK = '#141821';

function weapon(ctx, kind) {
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  switch (kind) {
    case 'bazooka':
      ctx.fillStyle = '#6b7d45';
      ctx.fillRect(-7, -3, 24, 6);
      ctx.strokeRect(-7, -3, 24, 6);
      ctx.fillStyle = '#3d4a26';
      ctx.fillRect(13, -3.5, 5, 7);
      ctx.fillStyle = '#c23b2a';
      ctx.fillRect(-9, -2.5, 3, 5);
      break;
    case 'shotgun':
      ctx.fillStyle = '#7a4a26';
      ctx.fillRect(-5, -2, 9, 4);
      ctx.fillStyle = '#3a3e48';
      ctx.fillRect(3, -1.6, 17, 3.2);
      ctx.strokeRect(-5, -2, 25, 4);
      break;
    case 'dynamite':
      ctx.fillStyle = '#d8342a';
      ctx.fillRect(3, -3, 6, 10);
      ctx.strokeRect(3, -3, 6, 10);
      ctx.strokeStyle = '#d9c9a0';
      ctx.beginPath();
      ctx.moveTo(6, -3);
      ctx.quadraticCurveTo(9, -8, 6, -10);
      ctx.stroke();
      break;
    case 'airstrike':
      ctx.fillStyle = '#4a5260';
      ctx.fillRect(2, -4, 8, 9);
      ctx.strokeRect(2, -4, 8, 9);
      ctx.fillStyle = '#7fff7a';
      ctx.fillRect(4, -2, 4, 2);
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.lineTo(10, -12);
      ctx.stroke();
      break;
    default: // grenade, cluster
      ctx.fillStyle = kind === 'cluster' ? '#c8432a' : '#4a6b2a';
      ctx.beginPath();
      ctx.arc(8, 0, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#c9c9c9';
      ctx.fillRect(7, -6, 2.5, 2.5);
  }
}

// s: { sx, sy, flinch 0..1, walk phase or null }; held: weapon id or null.
export function drawSoldier(ctx, u, color, s, held) {
  const f = u.facing;
  const body = s.flinch ? mix(color, '#ffffff', s.flinch * 0.8) : color;
  const dark = shade(color, -0.45);
  ctx.save();
  ctx.translate(u.x, u.y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(s.sx * 1.2, s.sy * 1.2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  // boots
  const step = s.walk == null ? 0 : Math.sin(s.walk) * 2;
  ctx.fillStyle = '#2b2b30';
  ctx.fillRect(-5 + step, -4, 4.5, 4);
  ctx.fillRect(0.5 - step, -4, 4.5, 4);
  // body and belt
  roundRect(ctx, -6, -16, 12, 13, 4);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = dark;
  ctx.fillRect(-6, -7, 12, 2.2);
  // head, eye looking along the aim
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(f * 0.8, -19.5, 5.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const ex = f * 2.6 + f * Math.cos(u.aim) * 0.9;
  const ey = -19.5 - Math.sin(u.aim) * 1.2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ex, ey, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillRect(ex + f * 0.4 - 0.7, ey - 0.7, 1.4, 1.4);
  // helmet: dome, brim, highlight
  ctx.fillStyle = shade(body, -0.2);
  ctx.beginPath();
  ctx.arc(f * 0.3, -21, 6.6, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(f > 0 ? -7 : -3.5, -21.6, 10.5, 2.2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(-3 + f, -25.4, 4, 1.6);
  // arm and weapon, along the aim
  ctx.translate(0, -11);
  ctx.rotate(Math.atan2(-Math.sin(u.aim), f * Math.cos(u.aim)));
  if (f < 0) ctx.scale(1, -1);
  if (held) weapon(ctx, held);
  ctx.strokeStyle = body;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(-1, 0);
  ctx.lineTo(held ? 6 : 3, held ? 1 : 5);
  ctx.stroke();
  ctx.fillStyle = SKIN;
  ctx.fillRect(held ? 5 : 2, held ? -0.5 : 4, 3, 3);
  ctx.restore();
}

export function drawGrave(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(-8, -15);
  ctx.arc(0, -15, 8, Math.PI, 0);
  ctx.lineTo(8, 0);
  ctx.closePath();
  const gr = ctx.createLinearGradient(-8, 0, 8, 0);
  gr.addColorStop(0, '#b4bac6');
  gr.addColorStop(1, '#6e7480');
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = '#4a4f5a';
  ctx.fillRect(-1.2, -19, 2.4, 11);
  ctx.fillRect(-4, -16, 8, 2.4);
  ctx.restore();
}
