# Artillery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use
> checkbox (`- [ ]`) syntax for tracking. TDD: write each listed test first, see it fail, implement,
> see it pass, commit.

**Goal:** A Worms-lite 2D artillery game with 15 visually distinct levels, campaign vs computer and
2-player hot-seat, installed on the Pi games server.

**Architecture:** Pure simulation in `src/core` and pure effect state in `src/fx` (tested with
`node --test`), canvas drawing/screens/input/audio in `src/ui`, wired by `src/main.js`. Core and UI
meet only through the `world` object and its `events` queue defined in the spec.

**Tech Stack:** Plain HTML/CSS/JS ES modules, Canvas 2D, WebAudio, `node:test`. No dependencies.

**Spec:** `docs/superpowers/specs/2026-10-16-artillery-design.md` — read it fully first; its
"Core contract" section is binding for every task.

## Global Constraints

- No npm dependencies, no bundler, no build step, no network at runtime; all URLs relative.
- Every code file < 200 lines (JS, HTML, CSS). Split by responsibility when approaching it.
- `src/core` and `src/fx` never touch `window`, `document`, canvas, `Math.random` or `Date.now`;
  randomness comes from `rng` passed in, time from `dt`.
- World is 1920×1080, y down. Logic steps at fixed 1/60 s.
- `localStorage` wrapped in try/catch; the game works without it.
- Runs in Chromium 153 (Pi kiosk) and current desktop browsers at 60 fps on a Pi 4: no per-frame
  `shadowBlur`; glow via cached radial sprites + `'lighter'`; ≤ 600 particles.
- Commits: Conventional Commits, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A soldier spawned on a steep slope or over a gap must stand on terrain, never inside it or in
   the air — test in Task 1 (`spawnPoints` leaves each spawn on the surface with clearance).
2. A projectile fast enough to cross a thin wall in one step must still hit it — test in Task 2
   (sub-stepping: 1200 px/s at a 4 px wall).
3. A shot leaving the world left/right/top must not hang the turn — test in Task 2 (projectile
   out of bounds is removed; turn reaches `settling` → next team).
4. The active soldier dying on its own turn (own grenade, drowning) must pass the turn, and a team
   with all dead must end the match — test in Task 2.
5. Timer running out while charging must end the turn without firing — test in Task 2.

---

### Task 1: Scaffold, rng, terrain, levels

**Files:** Create `package.json` (`{"name":"artillery","private":true,"type":"module",
"scripts":{"test":"node --test"}}`), `.gitignore`, `CLAUDE.md` (house rules = Global Constraints +
layout table from spec), `README.md`, `index.html` (canvas + `src/main.js`, placeholder main that
draws level 1 sky is fine), `src/core/rng.js`, `src/core/terrain.js`, `src/core/terrain-gen.js`,
`src/core/levels.js` (+ `levels-2.js` if > 200 lines), `test/core/*.test.js`, `test/repo.test.js`.

**Interfaces — Produces:**
- `makeRng(seed:number) -> () => number in [0,1)` (mulberry32).
- `class Terrain { constructor(w,h); mask:Uint8Array; solid(x,y):bool (out of bounds: false,
  except y >= h: true); carve(x,y,r):number removed; surfaceY(x):number (first solid y from top,
  h if none); }`
- `generateTerrain(levelTerrainSpec, rng) -> Terrain` — heightmap from summed sine/value-noise
  octaves; optional `islands`, `caves`, `platforms`, `chasm`.
- `spawnPoints(terrain, count, rng, liquidY) -> [{x,y}]` — on the surface, above liquid, ≥ 120 px
  apart, with 30 px headroom.
- `LEVELS: Level[15]` with fields exactly as listed in the spec "Levels" section:
  `{ id, name, sky:[[stop,color]…], layers:[{kind,color,height,roughness,speed}…], terrain:{…},
  fill:[top,bottom], edge, liquid:{kind:'water'|'lava', color, y}, gravity, windMax, friction,
  drag, ambient:'none'|'leaves'|'snow'|'fireflies'|'rain'|'fog'|'bubbles'|'embers'|'stars'|
  'pixels', aiSkill, pixel?:true }`.

**Tests (write first):** rng same seed → same sequence; terrain carve of r=10 in solid ground
removes ≈ π·100 px (±10 %) and `solid` is false at the centre after; `surfaceY` after carve moves
down; `generateTerrain` deterministic for a seed; for every level, `spawnPoints(…,6)` returns 6
points each on solid ground (`solid(x,y+2)`), clear above (`!solid(x,y-30)`), above liquid;
`LEVELS.length === 15`, ids unique, every field present and in range (gravity > 0, 0 ≤ aiSkill ≤ 1);
repo test: every file in `src`, `test`, `index.html` < 200 lines; no `http://`/`https://` in
`index.html` or `src/`.

- [ ] Write tests → fail → implement → pass → commit `feat(core): rng, terrain and 15 levels`.

### Task 2: Simulation — physics, soldiers, weapons, turns, world

**Files:** `src/core/physics.js`, `src/core/units.js`, `src/core/weapons.js`,
`src/core/explode.js`, `src/core/turns.js`, `src/core/world.js`, tests mirroring each.

**Interfaces — Consumes:** Task 1 exports. **Produces:**
- `createWorld(level, mode /* 'campaign'|'versus' */, rng) -> world` (spec contract; team 0 human,
  team 1 `ai:{skill:level.aiSkill}` in campaign, both human in versus; 3 units per team).
- `stepWorld(world, dt, intents, rng)` — `intents` as in spec; applies to the active unit only
  while `phase==='aim'`; integrates projectiles with sub-steps ≤ 4 px; pushes events.
- `WEAPONS: [{ id:'bazooka'|'grenade'|'cluster'|'airstrike'|'shotgun'|'dynamite', name, icon,
  … }]` with the spec's numbers.
- `explode(world, x, y, r, damage)` — carve, damage falloff `damage*(1-d/r)` to units with
  d < r + 8, knockback impulse away from centre, events `explosion`, `crater`, `damage`, `death`.

**Tests (write first):** projectile under gravity only follows the closed-form arc (±1 px after
1 s); wind changes x only for `windy`; drag slows; 1200 px/s shell hits a 4 px wall; grenade
bounces then explodes at fuse; cluster spawns 5 bomblets; airstrike spawns 5 missiles at
target x; shotgun hits the first unit on its ray and has 2 shots; dynamite placed at feet, 4 s;
damage falloff at d=0 and d=r/2; fall > safe height damages, short drop doesn't; unit touching
liquid dies; walking up a 1:1 slope works, a 2:1 wall blocks; out-of-bounds projectile removed and
turn advances; timer expiry while charging ends turn with no `fire` event; active unit killed on
own turn → next team; all of a team dead → `winner` set; both last units dead same turn → `'draw'`;
units rotate within a team; wind re-rolled each turn within ±`windMax`.

- [ ] Tests → fail → implement → pass → commit `feat(core): simulation, weapons and turns`.

### Task 3: AI

**Files:** `src/core/ai.js`, `test/core/ai.test.js`.
**Interfaces — Produces:** `aiPlan(world, rng) -> { weapon, moveSteps /* ±px */, aim, power,
target? }` and `aiIntents(plan, elapsed) -> intents` (walk, then aim, then charge/release; a
short think delay so humans can follow).
Search: for each live enemy, sample angle × power with the real projectile step (no terrain carve)
and pick the shot whose impact is nearest; then add noise `(1-skill)` × up to 25° / 25 %. Prefer
grenade/dynamite when the enemy is within 80 px, airstrike when no ballistic shot is clear.
**Tests:** skill 1 on flat ground, enemy 600 px away, no wind → simulated impact within 30 px of
the enemy; with wind, still within 50 px; skill 0 misses by more on average over 20 seeds; never
targets own team; returns within 50 ms.

- [ ] Tests → fail → implement → pass → commit `feat(core): computer opponent`.

### Task 4: FX state (parallel with Task 2)

**Files:** `src/fx/particles.js`, `src/fx/fx.js` (shockwaves, flashes, shake, floating text,
slow-mo), `src/fx/camera.js`, `src/fx/react.js` (`applyEvent(fx, event, rng, level)` turning
core events into effects), tests.
**Interfaces — Produces:** `createFx() -> fx`; `stepFx(fx, dt)`; `applyEvent(fx, ev, rng, level)`;
`camera = createCamera(); stepCamera(camera, focus|null, dt)` with `{x,y,zoom}` (zoom ≤ 1.3);
particles `{x,y,vx,vy,life,max,size,color,kind:'spark'|'smoke'|'debris'|'ember'|'splash'|…,
gravity, additive}`.
**Tests:** particle count capped at 600 (oldest dropped); particles expire after life; explosion
event creates flash + shockwave + debris + shake proportional to r; shake decays to 0; slow-mo
factor 0.3 for 1 s on a `win` event; camera zoom eases toward 1.3 with a focus and back to 1.

- [ ] Tests → fail → implement → pass → commit `feat(fx): particles, shake, camera`.

### Task 5: Rendering (after 1, 2, 4)

**Files:** `src/ui/sprites.js` (cached glow sprites), `src/ui/sky.js` (gradient + parallax per
level), `src/ui/ambient.js` (per-level ambient particles), `src/ui/terrain-view.js` (offscreen
terrain canvas: gradient fill, edge highlight, texture noise, pixel mode; `cut(x,y,r)` with
scorched rim), `src/ui/liquid.js`, `src/ui/units-view.js` (soldiers with team colour, aim reticle,
HP label, squash, gravestones), `src/ui/projectiles-view.js` (trails), `src/ui/fx-view.js`,
`src/ui/hud.js` (team HP bars, wind arrow, timer, weapon bar, power meter, turn banner).
**Interfaces — Produces:** `createView(canvas, level, world)`; `drawFrame(view, world, fx,
camera, t)`; `view.onCrater(x,y,r)`.
**Verify:** a dev page `dev.html?level=N` that renders each level statically; screenshot all 15
and check each is distinct and legible.

- [ ] Implement → screenshot all 15 levels → commit `feat(ui): rendering`.

### Task 6: Screens, input, audio, storage, game loop (after 3, 5)

**Files:** `src/ui/input.js` (keys per spec, mouse aim/airstrike target), `src/ui/audio.js`
(WebAudio synth sounds per spec, M mute), `src/ui/storage.js` (unlocked level, mute),
`src/ui/screens/*.js` (title, campaign map, versus setup, pause, round end), `src/main.js`
(fixed-step loop, AI intents for AI teams, drains events into fx + audio + view, screen routing).
**Verify (Playwright):** load `index.html` from a static server under a sub-path
(`/artillery/`); no console errors; start campaign level 1; fire a bazooka; computer takes its
turn; finish a round via a debug hook only available with `?debug`; level 2 unlocks.

- [ ] Implement → verify → commit `feat: playable campaign and versus`.

### Task 7: Polish, thumbnail, install (Fable)

- [ ] Play every level; fix legibility/performance; check frame time on the Pi with the `?debug`
      overlay (average ms per frame).
- [ ] `og.png` 1200×630 from a striking level.
- [ ] Add artillery to `../babak-games/games.json`, `./deploy.sh artillery`, `./smoke.sh`.
- [ ] Commit both repos.
