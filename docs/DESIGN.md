# Design

To be settled before anything is built. Each section ends as decisions, with the reasoning behind them; what's still open stays under Open questions.

## Pitch

A spy game. Single player, seen in 3D from an isometric-style camera, set in the present day.

## Pillars

## The player's loop

## Look

What the references (Disco Elysium, local copies in `ref/`, not committed) are for: the **angle** (a high, near-isometric camera looking down into streets and rooms, with cutaways so interiors read from above) and the **level of realism** (grounded people and places, small on screen, readable by silhouette and light). Not its painted style: this is not a Disco Elysium clone, and the look is ours to find.

How it gets found: once the toolchain is set up, many small look samples (a street corner, a room, a few people, different treatments of light, material and colour), and the user picks the ones that land.

Explored so far (nothing committed):
- **Realistic** (samples 000-004): MPFB people, CC0 photographic materials, PBR light; motion from Mixamo (samples 001, 004).
- **Cartoonish 3D iso** (sample 005, after a pixel-art reference from the user, 2026-10-25): one street rendered by `samples/lib/looks.js` as `pixel` (3D pixel art: low resolution, orthographic, toon light, outlines, quantised colour), `pixel-chunky`, `toon` (flat palette, bands, outlines), and `flat` (a low-poly toy), each with a chibi option (heads 1.5×). The pixel family reads best. Toon and flat still show people as dark silhouettes: stylised people need their own palette, not averaged photo textures.

## Systems

## Scale

The target entity count, set early: the code is built for it from the start.

## Stack

- In the browser if it stays the most convenient, like longhaul: the same save logic (IndexedDB, a save schema, additive upgrades on load), the same method (CLAUDE.md).
- three.js (0.186.1), vendored as ES module files in `vendor/three/` (`tools/vendor-three.mjs`) and loaded through an import map, so there is still no build step, no network and no package install to play. A departure from longhaul's hand-written WebGL2, made for skinned characters, glTF, shadows and post-processing.
- Content is made by scripts: Blender run headless for kits, MPFB (MakeHuman) for people, exported as glTF (see docs/PIPELINE.md).
- Buildings are assembled at runtime from short descriptions (footprint, storeys, openings, interior walls, stairs), dressed with Blender kit pieces. A city is data, and the cutaway (front walls to stubs, upper storeys hidden) is part of how buildings are made, not an afterthought.

## Open questions

- The look: realistic or cartoonish (pixel, toon, flat), settled by picking from samples (see Look).
