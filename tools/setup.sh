#!/usr/bin/env bash
# TRADECRAFT: set up the toolchain on a Mac. Safe to run again: every step skips what is done.
#
#   tools/setup.sh
#
# What it sets up, and what for:
#   Blender (with MPFB)  scenes, building kits, light baking, characters, glTF export;
#                        driven by scripts (blender -b --python ...), never by hand
#   MPFB + asset packs   MakeHuman's character generator: bodies, faces, clothes, hair
#                        (tools/blender/mpfb-packs.txt; CC0, and CC-BY credited in CREDITS.md)
#   ffmpeg               frames from the smoke tests into clips, to review motion
#   ImageMagick          contact sheets, texture work
#   mflux                image generation on this Mac (no API key): textures, signs, posters,
#                        portraits, concept frames; open-licensed models only (CLAUDE.md)
#   npm dev tools        three (vendored into vendor/three/ for the game), playwright-core
#                        (headless screenshots), gltf-transform (model optimisation)
# The game itself needs none of it to run: it loads vendor/three/ and its own assets.
set -eu
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
CACHE="${TRADECRAFT_CACHE:-$HOME/Library/Caches/tradecraft}/makehuman"
step() { printf '\n== %s\n' "$*"; }

step "Homebrew: blender, ffmpeg, imagemagick"
brew list --cask blender >/dev/null 2>&1 || brew install --cask blender
for f in ffmpeg imagemagick; do brew list "$f" >/dev/null 2>&1 || brew install "$f"; done
blender --version | head -1

step "npm dev tools"
npm install --no-fund --no-audit --silent
want=$(node -p "require('./node_modules/three/package.json').version")
if [ "$(cat vendor/three/VERSION 2>/dev/null)" != "$want" ]; then node tools/vendor-three.mjs; else echo "vendor/three is three $want"; fi

step "MPFB (Blender extension)"
BV=$(blender --version | head -1 | sed -E 's/Blender ([0-9]+\.[0-9]+).*/\1/')
EXT="$HOME/Library/Application Support/Blender/$BV/extensions/blender_org/mpfb"
if [ -d "$EXT" ]; then echo "installed"; else
  blender --online-mode -c extension install -s mpfb --enable 2>&1 | grep -v PROGRESS | tail -2
fi

step "MakeHuman asset packs -> $CACHE"
mkdir -p "$CACHE"
fetch() {   # <pack>/<zip name>: download unless the cached zip is complete
  local url="https://files2.makehumancommunity.org/asset_packs/$1.zip" out="$2/$(basename "$1").zip"
  local want have
  want=$(curl -sIL "$url" | awk 'tolower($1)=="content-length:" {v=$2} END {print v+0}')
  have=$(stat -f %z "$out" 2>/dev/null || echo 0)
  if [ "$want" -gt 0 ] && [ "$have" = "$want" ]; then return 0; fi
  curl -sfL -C - -o "$out" "$url" || curl -sfL -o "$out" "${url/files2./files.}" || { echo "FAILED $1"; return 1; }
  echo "got $(basename "$out")"
}
export -f fetch
grep -v '^#' tools/blender/mpfb-packs.txt | grep . | xargs -P 4 -I{} bash -c 'fetch "$1" "$2"' _ {} "$CACHE"
ZIPS=()
while read -r p; do ZIPS+=("$CACHE/$(basename "$p").zip"); done < <(grep -v '^#' tools/blender/mpfb-packs.txt | grep .)
blender -b --python tools/blender/mpfb_packs.py -- "${ZIPS[@]}" 2>&1 | grep -E '^MPFB packs|not registered|Error' || true

step "Local image generation: mflux (uv tool)"
brew list uv >/dev/null 2>&1 || brew install uv
# Pillow 13.0 imports a lazy-loading feature these Pythons lack (mflux fails at start): pinned below it.
if ! ~/.local/bin/mflux-generate-z-image-turbo --help >/dev/null 2>&1; then
  uv tool install --force --python 3.13 mflux==0.22.0 --with pillow==12.3.0
fi
echo "mflux $(~/.local/share/uv/tools/mflux/bin/python -c 'import importlib.metadata as m; print(m.version("mflux"))'); a model downloads on its first use through tools/gen.sh, which also saves its 8-bit copy"

step "done"
