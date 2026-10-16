# Barrage

A Worms-lite artillery game for the browser. Two teams of three soldiers trade bazookas, grenades,
cluster bombs, airstrikes, shotgun blasts and dynamite across destructible terrain. Play the
15-level campaign against the computer, or duel a friend on one keyboard.

Plain HTML and JavaScript modules: no dependencies, no build step.

```
python3 -m http.server 8000   # then open http://localhost:8000/
node --test                   # run the tests
```

Controls: ←/→ walk, ↑/↓ aim (or point with the mouse), Enter jump, hold Space (or the mouse
button) to charge and release to fire, Q/E or 1–6 change weapon, Esc pause, M sound.
Add `?debug` to the URL for a frame-time readout.

Design notes are in `docs/superpowers/specs/`.
