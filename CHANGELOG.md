# Changelog

One entry per release, newest first: what changed for the player, and the numbers that moved. Write it under Unreleased as the work happens; `tools/release.sh` stamps it with the version and the date.

## Unreleased

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

