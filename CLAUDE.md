# TRADECRAFT: working notes

A game, in design: nothing is built yet, and `docs/DESIGN.md` is where the design gets settled. This file is the method (how we version, play, test and work), carried over from longhaul (`../longhaul`) and tightened where longhaul taught us something.

## Commands

- `./play.sh`: serve the play copy (`.play/`, the release the user plays) on :8100 and open the browser. `./play.sh --dev`: the working tree, as it is now, on :8101. Both serve with `Cache-Control: no-store` and a deep listen queue (`tools/serve.py`), because a caching server lets the browser mix old and new modules after an update, and a queue of 5 resets the odd module request.
- `tools/promote.sh [vX.Y.Z]`: move the play copy to a release (default: the latest). `--status` says where it is and what is newer.
- `tools/release.sh patch "<summary>" --trailer "Co-Authored-By: …"`: cut a release (CHANGELOG's Unreleased becomes the version, VERSION bumps, tests run, commit, tag, push).
- `npm test`, or `node tests/run.mjs <filter>`: the tests. `npm run test:quick` (`QUICK=1`) leaves out the ones marked `heavy: true`; use it whenever the user may be playing. `SKIP=a,b` leaves out tests by name.
- `tools/awake.sh status | off | on | run <cmd…>`: the keep-awake lease (below).
- `tools/setup.sh`: set up the whole toolchain (below). Safe to rerun: each step skips what's already done.
- Browser smoke test: serve on a port of your own (`./play.sh --dev`, or `python3 tools/serve.py <port> <dir>`), drive it with `playwright-core` (install it in a scratch dir) and the system Chrome (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, headless). Collect `pageerror` and console errors. Kill the server after.

## Toolchain and assets

`docs/PIPELINE.md` is how content gets made. It covers the rules for picking a tool, which tool for which job, what each licence allows, the recipes, provenance, and a dated log of lessons. Read it before making or fetching any asset. When a tool choice changes or something surprises you, update it in the same change. The rules that never bend:

- **Scripts, not hands.** Blender runs headless (`blender -b --python tools/blender/<script>.py -- <args>`). A scene, a kit, a person or an image batch is a script in the repo. Generated `.blend` files and renders are build output.
- **Licences.** What ships is CC0, CC-BY (credited in `CREDITS.md` in the same change), or made by an image model PIPELINE.md allows for shipping. Qwen-Image 2.1 is samples only. A model whose licence isn't in PIPELINE.md isn't used until it is.
- **Provenance.** Every shipped asset has its sidecar `.json` saying how to make it again.
- **Secrets.** The Hugging Face token lives in `~/.cache/huggingface/token`: never in the repo, never printed. `*.private` is gitignored.
- **The game loads nothing from `node_modules`.** three.js is vendored in `vendor/three/` (import map: `"three"` → `./vendor/three/build/three.module.js`, `"three/addons/"` → `./vendor/three/examples/jsm/`). To use another add-on, add it to `ADDONS` in `tools/vendor-three.mjs` and rerun it. To bump three, change its pin in package.json, run `npm install`, and rerun the vendor script.
- **Art references** live in `ref/` (gitignored: commercial screenshots, never committed).

## Versions and releases

- `VERSION` holds the version: one place, read by the game and the scripts.
- Work goes out in PATCH releases (0.4.0, 0.4.1, 0.4.2…): one per round of work and one per batch of the user's patch requests, as many as needed. Bump them as you please.
- The MINOR moves only when the user declares a release candidate and then validates it; never on your own (`release.sh minor` refuses without `--user-validated`). The major (1.0) is the user's call too. Before the first playable build we're on 0.0.x; the first playable the user validates is 0.1.0.
- Every release goes through `tools/release.sh`: a commit `vX.Y.Z: <summary>` on `main` (subject under 72 characters; the detail goes in CHANGELOG.md, not the commit), an annotated tag, and a push when there's a remote. That's standing permission for release commits. Other commits, branches, merges and anything forced only when asked.
- CHANGELOG.md is the release history: what changed for the player and which numbers moved. Write the entry under `## Unreleased` as the work happens. The release history doesn't go in memory (longhaul's memory grew to 36 KB of it).

## The play copy (the user plays while we work)

- The user plays `.play/`, a git worktree pinned to a release tag. It changes only through `tools/promote.sh`, and only on the user's go ("update my game", "go", "promote"). Their game never changes under their feet, and the working tree is always ours: no scratch copy is needed just because they're playing.
- After a release, say what's in it and that it's ready to promote; don't promote unasked. If a release breaks their game, `tools/promote.sh <previous tag>` puts the last one back.
- Never touch `.play/`, the play port (:8100) or its saves otherwise. Saves live per browser origin: the play server's are the user's, and tests and smoke runs use other ports, so other origins.
- When the user may be playing (they said so, or `lsof -nP -iTCP:8100 -sTCP:LISTEN` shows the play server), the machine is shared: run `npm run test:quick`, and no heavy benchmarks unless asked.

## Scratch copies

- Use them for experiments, parallel agents and baselines: `git worktree add <scratchpad>/<name> [ref]` (or an agent's worktree isolation), named for what they hold (`base-v0.3.2`, `exp-pathing`). Remove them when done (`git worktree remove`).
- "Prep it but don't apply until I say go" means build it on a branch or a scratch worktree, show what changes, and merge on the go. That's separate from promotion: it keeps the change out of `main` itself.

## Keeping the Mac awake

- The user leaves long runs going and doesn't want to come back to a Mac that slept and stopped the work. The hooks in `.claude/settings.json` renew a one-hour lease on every prompt and tool call. `tools/awake.sh` holds the Mac awake while the lease is fresh and lets it go an hour after work stops. Nothing needs renewing by hand.
- A job that runs over an hour without tool calls (a long background simulation) is started with `tools/awake.sh run <cmd…>`.
- On battery, caffeinate alone failed once in longhaul. So the keeper also declares user activity, and turns the backlight off while nobody is at the keyboard (back on at the first touch). A closed lid on battery still sleeps: say so if the user is about to leave the Mac on battery.
- "Kill caffeinate" means `tools/awake.sh off` (it stays off until `on`). Check `tools/awake.sh status` before saying anything about it.
- Hooks load when a session starts: a new or changed hook needs a restart, or a look at `/hooks`.

## Docs

- `README.md`, `docs/*.md` and the module headers are the source of truth for the systems and their numbers. When a constant or behaviour they quote changes, update them in the same change.
- Memory holds only the user's preferences and the decisions not written in the repo.

## Rules of the code (from longhaul; confirm or amend them as the design settles)

- **Stack, by default:** vanilla ES modules, no build step, no runtime dependencies, browser, IndexedDB saves, fully playable offline. It changes only by decision, recorded in DESIGN.md.
- **The sim is pure.** It never touches the DOM. It reports facts on the bus it is given, and the UI decides how to show them.
- **One tick at a time**, in a fixed, documented order. Decisions made in a tick act the next.
- **State is plain data.** Keys starting with `$` are runtime-only and stripped from saves. A `SAVE_SCHEMA`: prefer additive changes that an `upgradeState` fills in on load, so players keep their games, and bump the schema only for a change that can't be filled in.
- **Randomness only through one seeded rng module**, so tests can seed it.
- **Units in constant names** (`rangeM`, `speedMs`). In longhaul, a wrong unit once made pirates charge to 800 km instead of 800,000 km.
- **Scale:** DESIGN.md sets the target entity count early, and the code is built for it from the start: spatial indexes, no per-tick work over every entity, and far-away things get outcomes, not simulation.
- **From day one:** a debug handle on `window` (`window.__tradecraft`: state, step(n), start(state)) for smoke tests, and save export/import as a JSON file, so a bug the user hits can be replayed exactly. Longhaul had to decode Chrome's IndexedDB blobs to get at a save.
- **Visuals obey the sim:** effects take their real time and scale, and one quantity shows one number on every screen, computed by one shared helper.
- **Style.** Every module opens with a header that explains its model in prose. Comments explain why. Match the surrounding density and naming.
- **Tests print the numbers that matter** (balance, timings). Read them; don't just count passes.

## Working with the user

- They often play while asking for changes, and drop in patch requests mid-round: fold those into the next patch release.
- If an auto-mode safety check blocks commands, say so and ask the user to switch permission modes, rather than working around it.
- Kill any server you start.
