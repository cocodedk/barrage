// Weapon icons for the HUD weapon bar, drawn as vector shapes in a 64 x 64 box.
const INK = '#141821';

function outline(ctx) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function shape(ctx, color, path) {
  ctx.beginPath();
  path();
  ctx.fillStyle = color;
  ctx.fill();
  outline(ctx);
}

const ICONS = {
  bazooka(ctx) {
    ctx.rotate(-0.5);
    shape(ctx, '#6b7d45', () => ctx.rect(-26, -7, 46, 14));
    shape(ctx, '#3d4a26', () => ctx.rect(12, -9, 10, 18));
    shape(ctx, '#c23b2a', () => ctx.rect(-30, -5, 6, 10));
    shape(ctx, '#3d4a26', () => ctx.rect(-6, 7, 6, 10));
  },
  grenade(ctx) {
    shape(ctx, '#4a6b2a', () => ctx.arc(0, 5, 17, 0, Math.PI * 2));
    shape(ctx, '#9aa0a8', () => ctx.rect(-6, -19, 12, 9));
    ctx.beginPath();
    ctx.arc(12, -16, 6, 0, Math.PI * 2);
    outline(ctx);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(-9, -4, 6, 5);
  },
  cluster(ctx) {
    shape(ctx, '#c8432a', () => ctx.arc(-2, 2, 15, 0, Math.PI * 2));
    shape(ctx, '#ffd24a', () => ctx.rect(-17, -1, 30, 6));
    for (const [x, y] of [[16, -14], [20, 4], [12, 18]]) shape(ctx, '#ffb02a', () => ctx.arc(x, y, 5, 0, Math.PI * 2));
  },
  airstrike(ctx) {
    ctx.rotate(Math.PI / 2);
    shape(ctx, '#6b7d45', () => {
      ctx.moveTo(-22, -6);
      ctx.lineTo(14, -6);
      ctx.lineTo(24, 0);
      ctx.lineTo(14, 6);
      ctx.lineTo(-22, 6);
    });
    shape(ctx, '#3a3e48', () => {
      ctx.moveTo(-22, -6);
      ctx.lineTo(-28, -14);
      ctx.lineTo(-14, -6);
      ctx.moveTo(-22, 6);
      ctx.lineTo(-28, 14);
      ctx.lineTo(-14, 6);
    });
    shape(ctx, '#ffd24a', () => ctx.rect(4, -6, 4, 12));
  },
  shotgun(ctx) {
    ctx.rotate(-0.35);
    shape(ctx, '#7a4a26', () => {
      ctx.moveTo(-28, 0);
      ctx.lineTo(-6, -4);
      ctx.lineTo(-6, 6);
      ctx.lineTo(-26, 12);
    });
    shape(ctx, '#3a3e48', () => ctx.rect(-6, -6, 34, 7));
    shape(ctx, '#5a3a1e', () => ctx.rect(4, 1, 14, 6));
  },
  dynamite(ctx) {
    ctx.rotate(0.25);
    shape(ctx, '#d8342a', () => ctx.rect(-9, -16, 18, 34));
    shape(ctx, '#f4e6c0', () => ctx.rect(-9, -4, 18, 6));
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.quadraticCurveTo(10, -26, 4, -30);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#e8d8b0';
    ctx.stroke();
    ctx.fillStyle = '#ffe14a';
    ctx.beginPath();
    ctx.arc(4, -30, 4, 0, Math.PI * 2);
    ctx.fill();
  },
};

// Draw weapon `id`'s icon centred at (x, y), `size` px across.
export function drawIcon(ctx, id, x, y, size) {
  const draw = ICONS[id];
  if (!draw) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 64, size / 64);
  ctx.lineJoin = 'round';
  draw(ctx);
  ctx.restore();
}
