# TRADECRAFT

A spy game in the browser: a CIA officer in Moscow, pixel art, tradecraft over reflexes. The design is settled in [docs/DESIGN.md](docs/DESIGN.md); the game is being built toward its first playable (0.1.0), a mechanic at a time. Today it opens on the free walk: a generated Moscow street, its people, the light going with the clock.

## Play

```sh
./play.sh          # the release you play (.play/), on :8100
./play.sh --dev    # the working tree as it is now, on :8101 (its own saves)
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

**In the game:** Z Q S D (W A S D on QWERTY; arrows too) walk, Shift runs, J opens the log, Space pauses, Esc opens the menu (save to a file, load one, debug mode). Keys are read by where they sit, so they work on any layout. `?play=walk&seed=3&hour=22` skips the title (for shots and tests); `window.__tradecraft` is the debug handle.

**Code:** `src/sim` (the pure sim: no DOM, one seeded rng, a fixed tick), `src/render` (the view), `src/ui` (keys, screens, saves), `src/art` (the look). Each module's header explains its model.

**Samples:** `./play.sh --dev`, then open http://localhost:8101/samples/: every sample with pictures. ★ marks the ones you like, and "Copy my picks" gives you a list to paste back.

Versions: patch releases (0.x.y) as the work goes; the minor moves when a release candidate is declared and validated. History is in [CHANGELOG.md](CHANGELOG.md); the method is in [CLAUDE.md](CLAUDE.md).

## Documentation

- [docs/DESIGN.md](docs/DESIGN.md): the game's design, settled before it's built.
- [docs/PIPELINE.md](docs/PIPELINE.md): how content is made: tools, licences, recipes, lessons.
- [CREDITS.md](CREDITS.md): third-party code and assets.
