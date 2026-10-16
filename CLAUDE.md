# Artillery — working notes

A Worms-lite artillery game in the browser: two teams of three soldiers on destructible 2D terrain,
fifteen levels that each look different, a campaign against the computer and a two-player duel. The
design is `docs/superpowers/specs/2026-10-16-artillery-design.md` and the build plan is
`docs/superpowers/plans/2026-10-16-artillery.md`; the spec is the authority.

## Commands

| What | Command |
|---|---|
| All tests | `node --test` |
| Play locally | `python3 -m http.server 8000`, then open http://localhost:8000/ |

## Layout

| Path | Contents | DOM? |
|---|---|---|
| `src/core/` | Rules and simulation: rng, terrain mask and generator, levels data, physics, soldiers, weapons, turns, AI. Pure, stepped by `dt`, randomness passed in. | no |
| `src/fx/` | Effect state: particles, shockwaves, flashes, shake, floating text, camera. Pure. | no |
| `src/ui/` | Canvas drawing, screens, input, audio, storage. | yes |
| `src/main.js` | Boot, game loop (fixed-step logic, rAF render), screen routing. | yes |
| `test/` | `node:test` suites, named `*.test.js`, mirroring `src/core` and `src/fx`. | no |
| `index.html` | One full-window canvas that loads `src/main.js`. | — |

## House rules

- Plain HTML, CSS and JavaScript ES modules. No npm dependencies, no bundler, no build step, no
  network at runtime; every URL is relative.
- Every code file stays under 200 lines (JS, HTML, CSS). Split by responsibility when near it.
- `src/core/` and `src/fx/` never touch `window`, `document`, canvas, `Math.random` or `Date.now`.
  Randomness comes from a seeded `rng` passed in, time from `dt`.
- World is 1920 x 1080, y down. Logic steps at a fixed 1/60 s.
- `localStorage` access is wrapped in try/catch; the game works without it.
- Performance target is 60 fps on a Raspberry Pi 4: no per-frame `shadowBlur`; glow comes from
  cached radial sprites drawn with `'lighter'`; at most 600 particles.
- Every behaviour has a test. Pixels are not tested; the state that drives them is.
- Commits are Conventional Commits.
