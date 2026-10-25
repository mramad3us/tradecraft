# TRADECRAFT

A game, in design. What it is and how it plays is being settled in [docs/DESIGN.md](docs/DESIGN.md).

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

**Samples:** `./play.sh --dev`, then open http://localhost:8101/samples/: every sample with pictures. ★ marks the ones you like, and "Copy my picks" gives you a list to paste back.

Versions: patch releases (0.x.y) as the work goes; the minor moves when a release candidate is declared and validated. History is in [CHANGELOG.md](CHANGELOG.md); the method is in [CLAUDE.md](CLAUDE.md).

## Documentation

- [docs/DESIGN.md](docs/DESIGN.md): the game's design, settled before it's built.
- [docs/PIPELINE.md](docs/PIPELINE.md): how content is made: tools, licences, recipes, lessons.
- [CREDITS.md](CREDITS.md): third-party code and assets.
