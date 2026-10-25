# Changelog

One entry per release, newest first: what changed for the player, and the numbers that moved. Write it under Unreleased as the work happens; `tools/release.sh` stamps it with the version and the date.

## Unreleased

## v0.0.10 (2026-10-25)

- `tools/gallery.mjs` removes the pictures of views that no longer exist.

## v0.0.9 (2026-10-25)

- Motion fixed: shoulders no longer shrug and hands no longer bend into flippers (the user caught it). The retarget now aligns only the clip's pose differences, never its skeleton's construction: against the recording, the shrug went from about 29° to 0.3° and the wrist bend from 90° to 12°. Fingers really curl toward the palm now (they splayed sideways before), along an axis derived from the hand rather than tuned by eye.
- Every bake prints a pose check against the recording (limbs, shrug, wrist, curl, lean), with limits that print WARN, kept in `.credits.json`. The recording's own skeleton is written to `<out>.motion.json`. `samples/001-motion/` draws it in orange over or beside the person (`?ghost=over|beside`), and takes `?orbit=front|side|back`, read from the motion.
- docs/PIPELINE.md: "How to judge motion", a checklist written after this miss.

## v0.0.8 (2026-10-25)

- The samples gallery: `samples/index.html` (open with `./play.sh --dev`, then `/samples/`) shows every sample and view as a picture that opens it live. ★ marks a pick, and "Copy my picks" gives a list to paste back. `tools/gallery.mjs` shoots the views on the GPU, failing on page errors, and writes `samples/index.json` and a contact sheet.

## v0.0.7 (2026-10-25)

- The building kit (`tools/blender/kit.py` → `assets/kit/kit.glb`): a casement window, a French window, a shopfront, a door, a double entrance, a flight of stairs, and a balcony. Each is bevelled, carries real dimensions, and states the opening it fills.
- Buildings at runtime (`samples/lib/building.js`): outer walls with openings, interior walls with doors, floors with stairwells, and a roof. Textures tile in true metres, with a dark section colour on cut faces. There are three cutaway modes (walls up, cut, down), plus hiding the storeys above the one viewed. `samples/lib/materials.js` makes materials from the fetched texture sets.
- `samples/003-building/`: a three-storey corner block with a shop, flats, balconies and stairs, on a cobbled pavement. One person walks outside, another talks upstairs.

## v0.0.6 (2026-10-25)

- `tools/fetch-asset.mjs`: search and fetch CC0 textures, models and skies from Poly Haven and ambientCG, game-sized, each with its `.source.json`. `samples/002-library/` puts them in the renderer: an asphalt street, a brick wall at true scale, a scanned armchair, a night-street sky as the light, and the walking man.
- People's clothes no longer shine like vinyl: no clear coat on cloth, hair or brows, and cloth matte, shoes with a little sheen.

## v0.0.5 (2026-10-25)

- `tools/gen.sh`: image generation through a saved 8-bit copy of each model (Z-Image-Turbo: 7.5 GB and 32 s an image, down from a 25 GB peak that swapped), writing each image's provenance (`.gen.json`) as it goes.

- People move. CMU motion capture (`tools/fetch-cmu.sh`) is baked onto MPFB people by `person.py --motions` through a new retargeting (`tools/blender/retarget.py`): a walk at 1.55 m/s with a planted foot sliding 0.12 m/s, a stealthy walk, and a two-person conversation. The hands follow the forearms with a relaxed curl, since the recordings carry no hand data.
- `samples/001-motion/`: the clips played under the iso camera, with `?check` (speed, facing, foot slide), `?strip` filmstrips and `?orbit&focus` close-ups. `samples/lib/stage.js` is the stage every sample now shares. `tools/shot.mjs` prints a page's `window.__report`.

## v0.0.4 (2026-10-25)

- docs/PIPELINE.md: how content is made. It covers the rules for picking a tool (real before generated, scripts, the least restrictive licence, local before hosted, provenance), which tool for which job, the licence table, recipes, what's still needed, and a log of lessons. CLAUDE.md keeps the rules that never bend and points to it.

- Image models: with the user's Hugging Face token, FLUX.2 klein 9B, Krea 2 Turbo and Ideogram 4 (readable text in images) are cleared for the game's art. Their licences are read and summarised in CLAUDE.md.

## v0.0.3 (2026-10-25)

- People no longer see-through: MPFB marked every material as blended, so the inside of the mouth and the backs of the eyes showed through the face. `person.py` now exports skin and eyes opaque, and hair, brows, lashes and clothes as cut-outs (soft-edged with MSAA in the sample). The red tie was there all along.
- `samples/000-toolchain/?cam=px,py,pz,tx,ty,tz` aims the camera anywhere, for close looks at faces and hands.
- `*.private` files are never committed (credentials).

## v0.0.2 (2026-10-25)

- Design: a contemporary spy game, single player, 3D from an isometric-style camera; the look is to be found through samples (docs/DESIGN.md).
- Toolchain (`tools/setup.sh`): Blender driven by scripts, MPFB (MakeHuman) with 34 asset packs for people, ffmpeg, and pinned npm dev tools (three.js, playwright-core, gltf-transform).
- three.js 0.186.1 vendored in `vendor/three/` (`tools/vendor-three.mjs`), loaded through an import map: still no build step and no network to play.
- Local image generation with mflux: no API key, nothing leaves the machine. Which models may ship images in this free game, and which are for samples only, is set out in CLAUDE.md.
- `tools/blender/person.py`: a person from a short spec (build, skin, hair, clothes, skeleton), exported as a game-ready glTF.
- `tools/shot.mjs`: screenshots in headless Chrome on the GPU, failing on page errors and missing files.
- `samples/000-toolchain/`: the toolchain check (a generated person under the iso camera).
- CREDITS.md: third-party code and assets, CC-BY credited.

## v0.0.1 (2026-10-25)

- Project boilerplate: the method carried over from longhaul (CLAUDE.md), the pinned play copy (`play.sh`, `tools/promote.sh`), releases (`tools/release.sh`), the keep-awake lease (`tools/awake.sh` and its hooks), the test runner.

