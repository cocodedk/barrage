// Camera over the 1920x1080 world. {x, y} is the world point at the screen centre, zoom
// scales around it. The whole world is fitted to the screen at zoom 1 (that fit is the
// renderer's job); the camera eases in on a focus (a flying projectile) and back out.
import { WORLD_W as W, WORLD_H as H } from '../core/terrain-gen.js';
import { clamp } from '../core/math.js';

export const MAX_ZOOM = 1.3;
const RATE = 4; // exp ease rate per second

export function createCamera() {
  return { x: W / 2, y: H / 2, zoom: 1 };
}

// focus: {x, y} to follow, or null to return to the whole-world view.
export function stepCamera(cam, focus, dt) {
  const k = 1 - Math.exp(-RATE * dt);
  cam.zoom += ((focus ? MAX_ZOOM : 1) - cam.zoom) * k;
  const hw = W / 2 / cam.zoom;
  const hh = H / 2 / cam.zoom;
  const tx = focus ? clamp(focus.x, hw, W - hw) : W / 2;
  const ty = focus ? clamp(focus.y, hh, H - hh) : H / 2;
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
}
