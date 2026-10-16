// ?debug: a corner readout of average frame, logic and render time (for measuring on the Pi),
// and window.__barrage so a test can end a round at once or read the game state.
const WINDOW = 60; // frames averaged

export function createDebug(api) {
  if (!new URLSearchParams(location.search).has('debug')) return null;
  const box = document.createElement('div');
  box.className = 'debug';
  document.body.append(box);
  globalThis.__barrage = api;
  let n = 0;
  let frame = 0;
  let logic = 0;
  let render = 0;
  return {
    sample(frameMs, logicMs, renderMs) {
      frame += frameMs;
      logic += logicMs;
      render += renderMs;
      if (++n < WINDOW) return;
      const f = frame / n;
      box.textContent = `frame ${f.toFixed(1)} ms (${(1000 / f).toFixed(0)} fps) · logic ${(logic / n).toFixed(2)} ms · render ${(render / n).toFixed(2)} ms`;
      n = frame = logic = render = 0;
    },
  };
}
