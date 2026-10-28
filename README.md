# TRADECRAFT

A spy game in the browser: a CIA officer in Moscow, pixel art, tradecraft over reflexes. The design is settled in [docs/DESIGN.md](docs/DESIGN.md); the game is being built toward its first playable (0.1.0), a mechanic at a time. Today it opens on the campaign: pick your officer for a posting (a Handler at the US embassy in Moscow, London, Beirut or Cairo), and day one starts in their flat (an interior: rooms you walk, the bed, the telephone, the kitchen), where Hale, the station's training officer, telephones: his exercises (the tutorial, played by your officer: the Farm's close combat, then seven lessons on the street, each one of the mechanic tests, tailing, being tailed, watching and photographing, a brush pass, a dead drop, blown, the umbrella, with Hale in your ear on an earpiece, and each to play on your own too), or straight in (run a network, watch a man, keep the heat down; Tab is the desk). Getting about: on foot, by taxi (hailed at the kerb when a free one comes), by bus on the city's numbered lines, or by the metro where the city has one (London's Underground, Moscow's, Cairo's). And the free walk: generated Moscow streets, their lanes and parks, their people, the light going with the clock, the weather with the day; and the same walk in London, Beirut and Cairo, each city its own.

## Play

```sh
./play.sh          # the release you play (.play/), on :8100
./play.sh --dev    # the working tree as it is now, on :8101 (its own saves)
```

On Windows (Git and Python 3 installed), from the cloned repo, double-click `play.cmd` or run:

```bat
play.cmd                  :: the play copy (made from the latest release the first time), on :8100
play.cmd --dev            :: the working tree, on :8101
play.cmd --promote        :: move the play copy to the latest release (or --promote v0.0.29), then play
play.cmd --status         :: where the play copy is
```

The play copy is pinned to a release and only moves when you say so:

```sh
tools/promote.sh            # to the latest release
tools/promote.sh v0.3.2     # to a given one (an older one too, to go back)
tools/promote.sh --status   # where it is, and what's newer
```

## Develop

```sh
tools/setup.sh              # the toolchain: Blender + MPFB and its packs, ffmpeg, npm dev tools, vendored three.js
npm test                    # all tests;  npm run test:quick leaves out the heavy ones
tools/release.sh patch "summary"   # release: changelog, VERSION, tests, commit, tag, push
tools/awake.sh status       # the keep-awake lease (hooks renew it while Claude works)
node tools/gallery.mjs      # rebuild the samples gallery (pictures of every sample view)
```

**In the game:** Z Q S D (W A S D on QWERTY; arrows too) walk, Alt (Option) held strolls, Shift runs, E held stops and looks (the move keys turn your eyes), E tapped glances back over your shoulder, C shows your character sheet (skills, Tradecraft, health part by part), F near someone opens what you can do with them (talk, with time standing still; violence, its openings; read them, their sheet as you guess it; in a fight, your read of them), T at the kerb hails a taxi, T at a shop's door goes in (out the front or the back, a bite, the toilet, a coat), T at a kiosk, a phone box or a park's notice board is somewhere to watch from, T at a bus shelter sits you down to wait for the bus (it asks where to when it comes), cars on the road stop for you on a zebra (and short of you anywhere in the road, though stepping out under one's nose shakes you), P takes a photograph where you've a camera, T picks up what lies within reach (bottles, bricks, pipes, knives…), G takes out a weapon you carry or puts it away, I shows what you carry and where (by length and bulk: trouser pockets, a coat's pockets, the beltline; a knife at your belt shows unless a coat hangs over it), H tends your wounds (first aid; F → First aid for someone else's), K L M (K L ; on QWERTY) hit, grab and cover in a fight (Shift held spends an edge), stood at a shop window facing it you look in it (its glass shows the street behind you, but for what your own back hides; E held slants your eyes along it), T does what your instinct offers, J opens the log, Space pauses, Esc opens the menu (save to a file, load one, debug mode). What your character isn't aware of is dimmed, and its people frozen as last seen. Keys are read by where they sit, so they work on any layout. `?play=walk&seed=3&hour=22` (or `?play=tail`) skips the title (for shots and tests), `&city=london` (or `beirut`, `cairo`) puts it in another city, `?weather=snow-heavy-gale` (or `rain-light`, `fog-extreme`, `frost`, `clear`…) pins the weather of every new game, and `&autoplay` has the game's own AI play your character (in the tail, as a follower); `window.__tradecraft` is the debug handle. In the tail, E held on a grey coat is a close look: is it him?

**Code:** `src/sim` (the pure sim: no DOM, one seeded rng, a fixed tick), `src/render` (the view), `src/ui` (keys, screens, saves), `src/art` (the look). Each module's header explains its model.

**Samples:** `./play.sh --dev`, then open http://localhost:8101/samples/: every sample with pictures. ★ marks the ones you like, and "Copy my picks" gives you a list to paste back.

Versions: patch releases (0.x.y) as the work goes; the minor moves when a release candidate is declared and validated. History is in [CHANGELOG.md](CHANGELOG.md); the method is in [CLAUDE.md](CLAUDE.md).

## Documentation

- [docs/DESIGN.md](docs/DESIGN.md): the game's design, settled before it's built.
- [docs/PIPELINE.md](docs/PIPELINE.md): how content is made: tools, licences, recipes, lessons.
- [docs/PLAYTESTS.md](docs/PLAYTESTS.md): what was played, what turned up, what was fixed.
- [CREDITS.md](CREDITS.md): third-party code and assets.
