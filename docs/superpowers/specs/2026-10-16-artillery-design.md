# Artillery — design

Date: 2026-10-16. Approved in conversation.

## Goal

A Worms-lite artillery game in the browser that looks brilliant: two teams of soldiers on
destructible 2D terrain, turn by turn, with many levels that each have their own look. Played on
the laptop and on the home Raspberry Pi (served by `../babak-games`, shown on its HDMI kiosk),
with keyboard (mouse optional). English only.

Success: from the Pi menu, Artillery opens; a full campaign of 15 levels is playable against the
computer, and any unlocked level as a 2-player hot-seat duel; every level is visually distinct;
explosions, terrain destruction and effects feel juicy; it holds ~60 fps at 1080p on a Pi 4.

## Stated by the user

- Worms-lite. Computer opponent and 2-player hot-seat. Many levels, each with its own look.
  2D is fine. English only. Separate project in `../artillery`, installed on the Pi.

## Rules

- Two teams × 3 soldiers, 100 HP each. Teams alternate turns; within a team, soldiers rotate.
- A turn: 30 s timer. The active soldier may walk (left/right, climbs slopes ≤ 1 px/px), jump
  (Enter), aim (up/down, angle), switch weapon (Q/E or 1–6), and fire (hold Space to charge power
  0–100 %, release to fire). After firing, 3 s of retreat time, then the turn ends when everything
  has settled (no live projectiles, all soldiers at rest).
- Wind: new random value each turn within the level's `windMax`; shown in the HUD.
- Falls deal damage above a safe height. Soldiers touching liquid (water, or lava on volcano) die.
- Explosions carve a circular crater, deal damage falling off linearly with distance, and knock
  soldiers back. A soldier at 0 HP dies with a small explosion of its own.
- A team with no living soldiers loses. Draw if both die in the same turn.

### Weapons

| Weapon | Behaviour |
|---|---|
| Bazooka | Wind-affected rocket, explodes on contact. r 40, dmg 50. |
| Grenade | Bounces (restitution 0.5), explodes after a 3 s fuse. Not wind-affected. r 40, dmg 45. |
| Cluster bomb | Like grenade; on explosion releases 5 bomblets (r 20, dmg 20). |
| Airstrike | Cursor picks an x; 5 missiles fall from the top along a line. r 25, dmg 25 each. |
| Shotgun | Hitscan ray, 2 shots per turn, small crater r 8, dmg 25. |
| Dynamite | Dropped at the soldier's feet, 4 s fuse, r 70, dmg 75. |

## Modes

- **Campaign**: levels 1–15 in order against the computer; winning unlocks the next. AI skill rises
  with level (aim noise shrinks, weapon choice improves). Progress in `localStorage` (try/catch;
  works without it).
- **Versus**: two humans, one keyboard, any unlocked level (all 15 unlocked in versus once beaten
  in campaign; level 1–3 always open).
- Screens: title, campaign map (level cards with their own art), versus setup, pause (Esc),
  round end (winner, replay / next / menu).

## Levels (15)

Each level is plain data in `src/core/levels.js`: name, sky gradient stops, 2–3 parallax layer
specs (shape + colour), terrain generator params (base height, octaves, roughness, islands/caves,
platforms), terrain fill + edge colours, liquid type + colour, gravity, `windMax`, ground
friction, ambient particle kind, AI skill.

1 Green Meadow (tutorial-calm) · 2 Desert Sunset · 3 Autumn Forest (falling leaves) ·
4 Arctic (slippery, snow) · 5 Jungle (fireflies) · 6 Neon City (night, glowing edges) ·
7 Candy Land · 8 Haunted Graveyard (fog, bats) · 9 Storm Coast (strong wind, rain, lightning
flashes) · 10 Underwater Reef (bubbles, slower projectiles = high drag) · 11 Volcano (lava,
embers) · 12 Pixel Retro (chunky pixel rendering) · 13 Glacier Canyon (deep chasm, floating
islands) · 14 Moon (low gravity, stars, earth in sky) · 15 Ember Sky Finale (red sky, strong
wind, lava, hard AI).

## Look and effects

- Sky gradient + procedural parallax silhouettes per level; ambient particles per level.
- Terrain drawn to an offscreen canvas once, with a fill gradient/texture and a bright edge line;
  craters are cut with `destination-out` circles plus a scorched rim, never a full redraw.
- Explosions: white flash, expanding shockwave ring, debris chunks in terrain colour that bounce,
  smoke puffs, sparks, screen shake scaled by radius.
- Projectiles leave glowing trails; floating damage numbers; soldiers squash on landing, flinch on
  hit; a gravestone where one dies.
- Camera: fit the whole 1920×1080 world to the screen; eases a zoom (≤ 1.3×) toward a flying
  projectile and back. Slow motion (0.3×) for 1 s on a match-deciding kill.
- Liquid surface: animated sine shimmer; splash particles.
- Sound: synthesized with WebAudio (no audio files): fire, explosion (noise burst + low thump),
  bounce, splash, jump, turn chime, win fanfare. Started on first key press. M mutes.
- Performance on Pi 4: no per-frame `shadowBlur`; glow via pre-rendered radial sprites drawn with
  `globalCompositeOperation = 'lighter'`; particle cap 600; fixed 60 Hz logic step.

## Architecture

Plain HTML, CSS, JavaScript ES modules. No npm dependencies, no bundler, no build step, no
network at runtime. Served as static files from any sub-path (all URLs relative).

| Path | Contents | DOM? |
|---|---|---|
| `src/core/` | Rules and simulation: rng, terrain mask, physics, soldiers, weapons, explosions, turns, AI, levels data, world. Pure, stepped by `dt`, randomness passed in. | no |
| `src/fx/` | Effect state: particles, shockwaves, flashes, shake, floating text, camera, slow-mo. Pure. | no |
| `src/ui/` | Canvas drawing (sky, terrain, soldiers, projectiles, fx, HUD), screens, input, audio, storage. | yes |
| `src/main.js` | Boot, game loop (fixed-step logic, rAF render), screen routing. | yes |
| `test/` | `node:test` suites mirroring `src/core` and `src/fx`. | no |

### Core contract (the seam between core, fx and ui)

World coordinates: 1920 × 1080, y down. Terrain mask: `Uint8Array(1920*1080)`, 1 = solid.

```js
world = {
  level,                       // level data object
  terrain,                     // { w, h, mask, solid(x,y), carve(x,y,r) -> removed px, surfaceY(x) }
  gravity, wind, liquidY,      // px/s², px/s² horizontal accel, y of liquid surface
  teams: [{ id, name, color, ai /* null | { skill 0..1 } */, units: [unit] }],
  projectiles: [proj],
  events: [],                  // core pushes; main drains each frame into fx + audio
  turn: { team, unit, timeLeft, phase /* 'aim'|'flying'|'retreat'|'settling'|'over' */,
          weapon, shotsLeft, power, charging },
  winner: null | teamId | 'draw',
}
unit = { id, team, x, y, vx, vy, hp, alive, facing /* -1|1 */, aim /* radians */, onGround }
proj = { kind, x, y, vx, vy, windy, fuse, restitution, radius, damage, owner }
```

Events: `{type:'fire'|'explosion'|'crater'|'damage'|'death'|'splash'|'bounce'|'jump'|'land'|
'turn'|'win', ...fields}` — explosion carries `x, y, r`; damage carries `unit, amount`.

Core API: `createWorld(level, mode, rng)`, `stepWorld(world, dt, input)` where `input` is the
active human's intents `{ left, right, jump, aimUp, aimDown, charge, release, weapon, target }`
(the AI produces the same intents), `aiPlan(world, rng) -> intents over time`.

## Testing

`node --test` covers: rng determinism; terrain generation is deterministic per seed and leaves
spawn room; carve removes the right area; projectile integration (gravity, wind, drag) and terrain
hit detection; grenade bounce and fuse; explosion damage falloff and knockback; fall damage and
drowning; turn rotation, timer and win/draw; AI finds a hitting shot on flat ground with skill 1;
every level's data validates; fx particles decay and are capped. A repo test enforces the 200-line
limit and no external URLs in `index.html`/`src`. Pixels are not tested.

## Out of scope

Online play, more than 2 teams, Persian, gamepad, ropes/teleport/other Worms utilities, a level
editor.

## Install

Add `{ "id": "artillery", "title": "Artillery", "src": "../artillery", "out": ".", "thumb":
"og.png" }` to `../babak-games/games.json`; deploy excludes `test`, `docs`, `*.md`. `og.png` is a
1200×630 screenshot of a level taken after the build.
