# Changelog

One entry per release, newest first: what changed for the player, and the numbers that moved. Write it under Unreleased as the work happens; `tools/release.sh` stamps it with the version and the date.

## Unreleased

## v0.0.28 (2026-10-26)

- **Being tailed:** the result paper no longer says "0 rolls" when the only rolls were your unseen checks.

## v0.0.27 (2026-10-26)

- **No clue to what your character doesn't know** (your note): an unread sign reads exactly as no sign, "November passes quietly." with no hedge. The papers count only the rolls you saw and the mix-ups you found out about, and the tail's "(maybe more)" is gone.

## v0.0.26 (2026-10-26)

- **You only know what your character knows** (your note):
  - **Being tailed:** what the FSB writes down stays hidden, unless you catch a watcher at it ("She may have seen you check. Maybe it's nothing."). The result paper says only what you know: whether you met him, the faces you marked, what you think they caught you at. The truth comes later, as the world tells it: SOLOVEY's next signal, or an arrest in the papers.
  - **The signs** of what they made of you (a car outside your building, a face twice on the way to work) need a Pathfinding roll to notice. Fail it, and November passes quietly, as far as you can tell.
  - **Tailing:** if he makes you while you're not looking, you don't know why the evening ended: he's "spooked". "What you didn't see" and the log's unseen entries show only in debug mode.

## v0.0.25 (2026-10-26)

- **Being tailed:** a check that catches a face behind you going your way says so ("You'll know that face again"), passers-by included, so a covert team leaves something to go on. SOLOVEY walks up to his bench if you're already watching it, rather than appearing on it.

## v0.0.24 (2026-10-26)

- **Mechanic test 2: being tailed** (title, Mechanic tests). A surveillance detection run: SOLOVEY, a source in the Ministry of Defence, will be on a bench in a park a street or two away for eight minutes. Walk there, and find out first whether the FSB is behind you.
  - **Some evenings nobody is.** Some, an overt pair, close and not caring if you see. Some, a covert team of three, well back, taking turns.
  - **Check your back the way people do:** a shop window's glass, a crossing, standing a while, or a glance over your shoulder (E tapped). A face seen again somewhere else is marked "seen before"; three times, or on two streets, "tail".
  - **They write down** what a professional does: running, glancing back where they can see, crossing away from the zebra, doubling back. It costs heat, and two together tell them what you are.
  - **Losing them:** take a lane none of them saw you take, and they never know where you went. Watch the lane's mouth from the other end: whoever comes out after you came for you.
  - **Then sit down with him (T), or call it off (T)** when the instinct says you're followed. A watcher's eyes on that bench and he's burned.
  - **The result paper** tells you who was really there, what they wrote down, and the faces you'd marked.
  - **Balance**, 60 evenings of scripted players: walking straight there burns him nearly every time a team is on you; checking your back calls it off rightly, though a covert team gets past a quarter of the time; shaking them up a lane works against a covert team about four times in ten.
- **An arrow at the picture's edge** shows the way to where you're going, with the streets and metres.
- **Getting about:** a helper (`sim/nav.js`) takes the watchers, and the scripted players, round railings and hedges and through the crossings and lanes. People in a hurry go round slow walkers.

## v0.0.23 (2026-10-26)

- **What characters are aware of, shown:** a ? over him when he half-notices something, a ! when he's seen you, if you're watching him. Passers-by turn their heads to look at someone running past, or at you if you stare at them close up (E held, 1.5 s).
- **Tailing:**
  - If you don't see him turn up a lane, the instinct doesn't know which one either (it no longer says he's in a shop).
  - Taking a different lane, or leaving the street without him, now says so: you went the wrong way.
  - A save and a load across a change of street play on the same (tested).
- **The scripted followers** (`tests/bots.mjs`) go round railings, lamp posts and parked cars, so their numbers measure the game. Over 100 evenings: naive made 79; careful sees the meeting 47, trained 61.
- **Playtests** are logged in `docs/PLAYTESTS.md`: what was played, what turned up, what was fixed, what's still rough.

## v0.0.22 (2026-10-26)

- **Every side of the map leads somewhere** (you asked for it). The city is rows of streets, each its own map:
  - **North:** side streets and narrow, dark alleys run through the terrace to the next street.
  - **South:** past the boulevard there's now its far road (with a zebra) and far pavement, or, a stretch at a time, a park with a pond, a fountain, a monument, a kiosk or flower beds; then a hedge with lanes leading on south.
  - **East and west:** the street goes on (the free walk is endless now too).
  - Walk off through a lane and you come out at its other end on the next street, with an autosave. Streets, boulevards, parks and lanes have Moscow names, shown under the watch.
  - Passers-by use all of it, and never pop into view.
- **The free walk's instinct:** it names the lanes and where they lead, offers to cross at the zebras (T), to sit on a bench, to look in a window, and between those, a lesson or two.
- **Tailing:** once an evening he may turn up a side street or an alley to the next street. Give him the corner, then follow him through, or lose him. The instinct's lines hold longer when calm (no more flicking between two).
- **Balance** (40 evenings): naive made 34; careful sees the meeting 22, trained 24 to 28.
- Saves from before this load onto a regenerated street.

## v0.0.21 (2026-10-26)

- **Perception** (you asked for it: where we look, what characters are aware of). Everyone faces a way and sees a cone ahead, as far as the light allows, plus a small radius of awareness all round; walls block the view. Awareness widens both.
  - **The screen shows what your character is aware of.** The rest is dimmed and frozen as it was last seen: people out of sight stand where you saw them, mid-step, until you look that way again. At night, lamplit pools stay visible far off and the dark between them doesn't.
  - **New keys:** Alt (Option on a Mac) held strolls (0.95 m/s, to keep a pace); E held stops and looks, the move keys turning your eyes; E tapped glances back over your shoulder for a second, walking on.
  - In numbers: a cone of 100° plus 2° a point of Awareness (a Handler's ≈ 132°); reach 18 m + 34 m × the light (50 m by day, 34 m into a lamp's pool at night, 22 m into the dark); awareness 2.5 m + 0.2 m a point (≈ 5.7 m).
- **Tailing, rebuilt on perception and made to play** (mechanic test 1):
  - **Each run is an evening:** dusk, night, the lunchtime crowd, or a wary evening (he checks more, warns less).
  - **His checks come with tells** (he slows, drifts to a window, glances at the kerb). If you're watching him, Awareness reads them, and the instinct warns you in time to act. The check itself needs you in his sight, so being out of his line of sight, or in the dark between lamps, is safe.
  - **Cover on T:** the instinct offers what fits where you stand: look in a shop window (its glass shows the street behind you), sit on a bench, tie a shoelace, cross at the zebra. Starting it as he looks is worse than nothing.
  - **More of your choices count:** standing about, staring at him, your back to him, lamplight at night, jaywalking, glancing back.
  - **His alertness** rises with near things and brings his checks closer.
  - **Lookalikes:** men in grey coats and hats walk the street, and you can end up following the wrong one until you're close enough to see it.
  - **The marker** is over whom you take for him, hollow where you last saw him when he's out of sight.
  - **The instinct always speaks**, the voice of training, with dry humour now and then ("You have no idea where he went…"). Its border shows how pressing it is.
  - **You only learn what you see:** a check of his you didn't see isn't narrated. The result paper lists them after ("what you didn't see"), and you may notice the change in him later.
  - **Balance** over 100 evenings: a naive tail is made 91 times; a careful one sees the meeting 60 times, a trained one 67. Lunch is the hardest evening, night the easiest.
- **The brief** lists the keys the test needs. **The result** adds how many of his checks you read in time and how often you followed the wrong man.

## v0.0.20 (2026-10-26)

- **Mechanic test 1: tailing a target** (title, Mechanic tests). Gennady Orlov, a former GRU officer, leaves his office on a Tuesday at 16:45 and walks east through the dusk to a meeting. Follow him, don't be seen twice, and see whom he meets.
  - **A brief** before it starts. **A brass marker** over him while you have him; it goes when you lose him.
  - **His habits:** looking back, studying a shop window's reflection, going into a shop and coming out looking, crossing the road, a pause on his phone. After a first sighting he dry-cleans: a little later he doubles back.
  - **The dice:** his Pathfinding against your Deception at each of those moments. The modifiers are your choices: distance, the other pavement, people about you, the dark, not running, not stopping when he stops. Your Tracking keeps him at a distance, your Awareness finds him again. Every roll is in the log with a line of flavour.
  - **The instinct** (a line at the foot of the picture) warns that you're too close, he's stopped, he's pulling away, he's in a shop. T does what it says when there's something to do: look in a shop window.
  - **The meeting:** a man in a blue beanie joins him on a boulevard bench. Watch from close enough, not too close: the other man has eyes too.
  - **A result paper:** seen, made, lost, missed or blown, with the numbers. Play the same evening again, or another.
  - **Balance**, by scripted followers over 30 evenings: tailing 10 m behind is made 9 times in 10; the other pavement, 20 m back, sees the meeting 6 times in 10.
- **Opposed rolls:** the totals decide, naturals included (they had given every contest a one-in-ten floor of failure); ties still go to us.
- **The street:** lamps keep clear of the crossings. Passers-by keep to their lanes and step round what blocks them; nobody gets stuck now.
- **A new section of street** is built over a few frames (it had cost a 76 ms stall); the endless street holds 60 frames a second.
- **The log's lines** now come in at the top left, three at most. **The November sunset** is cooler.

## v0.0.19 (2026-10-26)

- **The look is picked** (the user, 2026-10-26): chibi people in the fine town. Sample 007 shows it with `?people=chibi`, and the gallery has it by day and by night.
- **The game's skeleton, played as the free walk** (the title's first choice): a Handler from the US embassy on a Moscow boulevard, Monday 2 November 2026, 15:40.
  - **The street** is generated in 45 m sections, the same every time for a seed:
    - a terrace in Moscow ochres, pinks and greens, red brick or Stalinist stone, with shops signed in Cyrillic (АПТЕКА, ПРОДУКТЫ, ОДЕЖДА…), entrances, arches to the courtyards and side streets;
    - a wide pavement with lamps, the road with parked cars and a zebra;
    - a boulevard with railings, lawns, trees, a gravel path and benches.
  - **Passers-by:** about 30 on the map in the afternoon, up to 40 per 100 m at the busiest hours, a handful at night. They walk the lanes, look in shop windows, cross at the zebra, sit on benches, and go into shops, arches and side streets.
  - **Light from the clock:** the real sun over Moscow sets at 16:50 that day. The light warms, then goes blue; windows light up house by house; the lamps come on, with their pools of light. People and trees take the light where they stand, the same light the dice will read.
  - **Moving:** walk at 1.45 m/s, run at 3.6. The camera follows, snapped to the pixel grid. A tree in front of you is seen through.
  - **Screens:** the watch, the log's lines as they come, the keys labelled as your keyboard prints them; J opens the log, Space pauses, Esc opens the menu.
  - **Saves:** an autosave every 30 game minutes, on leaving the page and on quitting. The menu saves to a file and loads one. Debug mode (menu) adds a manual save, and ] / [ move the clock on.
- **Under it** (`src/sim`, pure):
  - the tick: 20 a second, in a fixed order, the same game twice from a seed and across a save and a load (tested);
  - the calendar;
  - the sun;
  - skills, as (base + practice) × (1 + weight × Tradecraft / 100);
  - checks and opposed rolls, with natural 1s and 20s, hooks, and ties to us, each written in the log;
  - the three gauges, drifting back a step a week;
  - heat per legend per country, starting at 20 under official cover;
  - generated passers-by with Russian names.

  In the browser: one draw for the whole crowd; 60 frames a second.
- Art moved to `src/art/`, shared by the game and the samples (samples 006 and 007 render pixel for pixel as before).

## v0.0.18 (2026-10-26)

- Sample 007, fine town: sample 006's street in a finer finish, after Stoneshard (Q155).
  - **People** (`samples/lib/finepeople.js`): a 24 × 40 cell, faces with glinting eyes, brows, cheeks and a mouth, legs and boots that show, six hue-shifted tones a colour, the outline softened on the lit side.
  - **Motion:** limbs drawn between joints give an 8-frame walk, a 6-frame run, and an idle that breathes and blinks.
  - **Surfaces:** bevelled bricks and slabs, weathered plaster showing brick, ivy, puddles, weeds, litter.
  - **Colour:** a 116-colour palette and a warm grade.
  - **View:** 640 × 360; `?res=480` shows sample 006's frame.
- Stoneshard measured: its people are 2.4 heads tall, close to our chibi, not the tall, small-headed figures I first described. The difference is the finish. DESIGN.md and PIPELINE.md corrected.
- `samples/lib/mainstreet.js`: the street of samples 006 and 007, built once; sample 006 renders pixel for pixel as before.
- `pixelart.js`: OKLCH colour, `tone()`, `noise()`, `nearest()`, the fine palette, a warm grade, any resolution, palettes up to 128 colours.

## v0.0.17 (2026-10-26)

- The design is settled: DESIGN.md now holds the user's answers to round 2 of the debrief as decisions:
  - postings played in chapters (key days in full, the rest summarised); an active day of 20–40 minutes;
  - leads beside intelligence; intelligence changes the world, seen in the news and briefings;
  - the ladder Recruit, Officer, Handler, Undercover, Illegal; the classes and over-skills: Tradecraft, Warfighting, Intuition (cops, up to special agent), Streetwise;
  - checks: a trained base 0–20, practice 0–3, over-skill 0–100 with a weight per skill, opposed rolls with environmental modifiers; Awareness, Tech and Medicine added; a hook halves the difficulty;
  - one heat number, read only through the instinct's signs;
  - a lost character is lost (a new one among generated candidates; debug mode allows reloading);
  - agency services on replenishing credits; two purses; a cover standing gauge;
  - observation on E, the camera on C, shooting paused like CQC, knockouts that can kill, no driving, transit playable when it matters;
  - maps larger than a screen with a following camera.

  0.1.0 is a few weeks as a Handler in Moscow, 5–10 hours, with all nine kinds of assignment.
- My calls to close the last holes, marked as such: what makes a day key, the summary between chapters, heat thresholds, Tradecraft's weights per skill, who rolls against whom.
- Road to 0.1.0: the look, a skeleton, eight mechanic tests the user scores, then joining them.

## v0.0.16 (2026-10-26)

- DESIGN.md rewritten from the user's 101 answers to the design debrief (round 1), as decisions:
  - pillars, and the loop at every scale from seconds to a career;
  - world and setting, ranks and classes, postings and the day, time, intelligence;
  - skills and d20 checks, the fear/trust/affinity gauges and hooks;
  - cover, exposure and the hunted state; networks; the agency and special forces;
  - moment-to-moment play (CQC as rock, paper, scissors on K/L/M; the T instinct), presentation, saves;
  - the first playable: a CIA officer at the US embassy in Moscow.

  My proposals are marked as such, each tied to a round-2 question.
- Scale settled: compact maps, about 50 people on screen at the busiest, no city simulation (geopolitics and persistent characters only). The technical base waits for the design, as the user asked (Q101).
- Design debrief round 2 (Q102–Q162, same page): the holes and tensions in round 1, each section opening with a read-back to correct, most questions leading with my proposal.

## v0.0.15 (2026-10-25)

- People run properly side-on: the back leg bends and kicks up behind, and the arms are bent, where they swung out straight like sticks. The in-between frames are airborne, one knee up, instead of standing still.
- `?view=sheet&cols=right:run0,…` on sample 006 picks the frames to lay out.
- Release numbering: `tools/release.sh rc`. 0.1.0-rc1 when the user declares a candidate (`--user-declared`), rc2, rc3… for fixes to it, and 0.1.0 when they validate it. `promote.sh` sorts a release after its candidates.
- DESIGN.md: the user's pitch (ranks, intelligence, character sheets for everyone, a real-time clock, crowds, varying light), and controls (ZQSD read by physical key, F, I).

## v0.0.14 (2026-10-25)

- Chibi town, second pass, after the user's scores (camera 95, night 90, environment 80, characters 35: "front view is too boxy"):
  - People are pixel sprites now (`samples/lib/sprites.js`). Each part is a template in three views, recoloured per person from palette ramps, shaded as a pixel artist would: upper-left light, shadow under hair and chin, inner lines between parts, an ink outline. Frames: idle 2, walk 4, run 4, sit.
  - In the street, people are upright cards one texel to a pixel, snapped to the pixel grid, and lit at night by the pools they stand in. `?people=boxes` brings back the box people for comparison.
  - Trees are drawn sprites (leaf clumps lit from the upper left, bark), casting their silhouette's shadow. New props: potted shrubs, a post box, a café chalkboard, bistro tables and chairs, a bicycle, pecking pigeons, flower boxes under windows, posters in the alley.
  - `?view=sheet` lays the cast's sprites out flat.

## v0.0.13 (2026-10-25)

- Chibi town (sample 006), after the user asked for simple pixel art, handheld-RPG style. `samples/lib/pixelart.js` renders 480 × 270 through a 45° orthographic camera at 16 px a metre, with inked outlines and one 50-colour palette. `samples/lib/chibi.js` makes people 29 px tall from a few boxes: 15 × 13 heads with painted faces and profiles, hats, beards, glasses, coats and dresses, things carried. They're posed in code at 8 fps: idle, walk, run, sit, crouch. `samples/lib/pixeltown.js` paints the street: facades, signs in a 3 × 5 pixel font, kerbs, a zebra crossing, trees, lamps, benches, café tables, cars and a taxi. Night lights windows, signs and lamps.
- Gallery: pixel-art samples get crisp PNG shots at twice their native size (no smoothing, no JPEG).

## v0.0.12 (2026-10-25)

- Animation libraries: `tools/blender/animlib.py` fits a whole folder of clips once to MPFB's mixamo skeleton, checking each against its recording. `samples/lib/anim.js` re-bases them onto any person on that rig. The first Mixamo clip (a walk) passes every check: limbs 0°, shrug 2°, wrists as recorded, real finger curl, head tilt 0.7°. `retarget.py` now has a profile per library (CMU, Mixamo). The rest of the Mixamo clips wait on Chrome's permission for multiple downloads. `samples/004-mixamo/` shows the library.
- Looks (`samples/lib/looks.js`, sample 005): the same street rendered as realistic, 3D pixel art (pixel, pixel-chunky), toon, and a low-poly toy (flat), with a chibi option. `samples/lib/street.js` is the shared street (trees and a lamp post added). `samples/lib/motion-view.js` is the shared motion review.

## v0.0.11 (2026-10-25)

- Two more pose checks, for what the user caught at "60/100": head tilt (beyond the recording's) and hand clearance (fingertip to thigh surface, negative = inside the leg). The CMU walk fails the second, at -0.02 m.

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

