# Design

To be settled before anything is built. Each section ends as decisions, with the reasoning behind them; what's still open stays under Open questions.

## Pitch

A spy game. Single player, set in the present day, one character controlled: an intelligence operative. Not the analyst, not the special forces, though we work with both in various capacities. The player is always in the field, collecting intelligence, but the shape of the work changes with rank.

What the user has said (2026-10-25), to be turned into decisions by the design questions:
- **Ranks.** Examples of playable ranks: recruit, agent, handler, undercover, illegal. To be defined; the gameplay changes with them.
- **The work.** Intelligence gathering, network building, recruiting contacts, maintaining a cover.
- **Intelligence** is one notion, kept simple: "intelligence". Some people hold some that matters to us, and we need to obtain it. HUMINT is carried in people's heads; SIGINT is hacked or finessed out of devices; and other kinds.
- **People.** Every character, even a throwaway NPC who won't outlive a scene, has an RPG-like character sheet with stats. The player meets all manner of civilians, some holding relevant intelligence.
- **Time.** A real-time clock; some actions pass time faster.
- **Scale.** Many characters on screen at once, mostly city situations. Each scene can be seen under varying light.
- **Controls.** Keyboard mostly. Move with ZQSD (an AZERTY keyboard: the keys in WASD's place), interact F, inventory I.

## Pillars

## The player's loop

## Look

What the references (Disco Elysium, local copies in `ref/`, not committed) are for: the **angle** (a high, near-isometric camera looking down into streets and rooms, with cutaways so interiors read from above) and the **level of realism** (grounded people and places, small on screen, readable by silhouette and light). Not its painted style: this is not a Disco Elysium clone, and the look is ours to find.

How it gets found: once the toolchain is set up, many small look samples (a street corner, a room, a few people, different treatments of light, material and colour), and the user picks the ones that land.

Explored so far (nothing committed):
- **Realistic** (samples 000-004): MPFB people, CC0 photographic materials, PBR light; motion from Mixamo (samples 001, 004).
- **Cartoonish 3D iso** (sample 005, after a pixel-art reference from the user, 2026-10-25): one street rendered by `samples/lib/looks.js` as `pixel` (3D pixel art: low resolution, orthographic, toon light, outlines, quantised colour), `pixel-chunky`, `toon` (flat palette, bands, outlines), and `flat` (a low-poly toy), each with a chibi option (heads 1.5×). The pixel family reads best. Toon and flat still show people as dark silhouettes: stylised people need their own palette, not averaged photo textures.
- **Chibi town** (sample 006, 2026-10-25): none of the above passed the user's "sniff test". They asked to simplify: "pixel art 100%, but simple, almost 2D", a handheld RPG (Pokémon-like) with big heads and almost invisible legs, barely modelled. Their reasoning: few animations, lots of freedom, and it scales very easily. References: a top-down pixel RPG camp, with closeups of its 32-px characters (heavy dark outlines, faces of a few pixels, beards, boots). Built as pixel art from simple 3D:
  - The frame is 480 × 270, scaled by a whole number with hard pixel edges.
  - The camera looks straight on and 45° down, orthographic, so a metre is 16 px on the ground, up a wall and across.
  - One 50-colour palette; every pixel snaps to it.
  - Outlines are inked where parts meet: dark at a silhouette, lighter between touching parts.
  - People are pixel sprites, about 28 px tall. Each part (head, face, hair, hat, beard, glasses, body by kind of top, arms, legs) is a small template in three views (front, back, side; the other side mirrored). They're recoloured from palette ramps per person and shaded by rule, as a pixel artist would: light from the upper left, shadow under hair and chin, darker lines where parts overlap, an ink outline. Frames are poses of the parts (bob, arm swing, step, stride, sit) at 8 a second, so a new hat or coat animates for free. In the street a person is an upright card: at this camera a metre is 16 px both up and across, so a card shows its sprite one texel to one pixel.
  - Trees and props are sprites too (leaf clumps shaded round from the upper left, a bark trunk; a post box, shrubs, bistro furniture, a bicycle, pigeons). Their cards cast the sun's shadow: the silhouette flattened on the ground.
  - Facades, signs and the ground are painted pixel textures on boxes (flower boxes and posters included).
  - Night lights the windows, signs and lamps, with hard-edged pools of lamplight; a sprite takes the light of the pool it stands in.
  - The user's scores (2026-10-25), for the first build with box people: camera angle 95/100, night colour shift 90, environment 80 ("tree needs work, things lack flair"), characters 35. Head-to-body ratio good; front views "too boxy"; some profiles good. The sprites, the trees and the flair answer that; their verdict is pending.

## Systems

## Scale

The target entity count, set early: the code is built for it from the start.

## Stack

- In the browser if it stays the most convenient, like longhaul: the same save logic (IndexedDB, a save schema, additive upgrades on load), the same method (CLAUDE.md).
- three.js (0.186.1), vendored as ES module files in `vendor/three/` (`tools/vendor-three.mjs`) and loaded through an import map, so there is still no build step, no network and no package install to play. A departure from longhaul's hand-written WebGL2, made for skinned characters, glTF, shadows and post-processing.
- Content is made by scripts: Blender run headless for kits, MPFB (MakeHuman) for people, exported as glTF (see docs/PIPELINE.md).
- Buildings are assembled at runtime from short descriptions (footprint, storeys, openings, interior walls, stairs), dressed with Blender kit pieces. A city is data, and the cutaway (front walls to stubs, upper storeys hidden) is part of how buildings are made, not an afterthought.

## Controls

- Keyboard first. Movement reads `KeyboardEvent.code` (physical positions: KeyW/KeyA/KeyS/KeyD are Z/Q/S/D on the user's AZERTY keyboard), so it works on any layout. Labels on screen name the keys as the player's own layout prints them (`navigator.keyboard.getLayoutMap()` where the browser has it).
- Interact F, inventory I; the rest to be settled.

## Open questions

- The design questionnaire (2026-10-25): game loop, ranks, intelligence, characters, cover, world, controls, scope. Its answers become the sections above.

- The look: leaning to chibi pixel art (sample 006); settled by the user's pick (see Look).
