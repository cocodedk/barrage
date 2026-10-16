// Small numeric helpers shared by core, fx and ui.
export const DEG = Math.PI / 180;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
