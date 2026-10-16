# Contributing to Barrage

## Local setup

1. Install Node 20 or newer (for the tests) and Python 3 (or any static file server).
2. Clone the repository and install the git hooks:

   ```sh
   ./scripts/install-hooks.sh
   ```

3. Serve the folder and open http://localhost:8000/:

   ```sh
   python3 -m http.server 8000
   ```

There is nothing to install: no npm dependencies, no bundler, no build step.

## Commands

```sh
node --test                    # all tests
python3 -m http.server 8000    # play locally
```

## Git hooks

`./scripts/install-hooks.sh` sets `core.hooksPath` to `.githooks/`:

- **pre-commit** runs `node --test`.
- **commit-msg** requires [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `ci:`, `perf:` ...).
- **pre-push** refuses push URLs outside `github.com/cocodedk/` and blocks force-pushes to, or
  deletion of, `main`.

`core.hooksPath` is per-clone config, so a fresh clone has no hooks until the script runs.
`--no-verify` skips them; CI runs the same tests anyway.

## House rules

- Plain HTML, CSS and JavaScript ES modules. No dependencies and no network at runtime; every
  URL is relative, so the game also works offline and under a sub-path.
- Every code file stays under 200 lines. Split by responsibility when one gets close.
- `src/core/` and `src/fx/` stay pure: no `window`, `document`, canvas, `Math.random` or
  `Date.now`. Randomness comes from a seeded `rng`, time from `dt`.
- Every behaviour has a test. Pixels are not tested; the state that drives them is.
- Keep it at 60 fps on a Raspberry Pi 4: no per-frame `shadowBlur`, at most 600 particles.

## Pull requests

Branch from `main` with a prefix that matches the commit type (`feature/`, `fix/`, `docs/`,
`refactor/`, `chore/`, `ci/`), in kebab-case.

- [ ] `node --test` passes.
- [ ] Played the change in a browser (`dev.html` helps for rendering work).
- [ ] Docs updated if behaviour or controls changed.
