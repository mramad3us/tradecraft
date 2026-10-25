#!/usr/bin/env bash
# TRADECRAFT: generate an image on this Mac, and record how (the provenance sidecar).
#
#   tools/gen.sh <model> --out <file.png> --prompt "…" [--seed N] [--width W --height H] [--steps N]
#                [--q 8|4|none] [-- <any other mflux arguments>]
#
# Models (docs/PIPELINE.md says which may ship): z-image-turbo, flux2-klein-4b, flux2-klein-9b,
# krea-2, ideogram-4-fp8, qwen-image-2.1 (samples only).
#
# Two things this does that calling mflux directly doesn't:
#  - It runs from a saved, pre-quantised copy of the model (~/Library/Caches/tradecraft/models/
#    <model>-q<N>, made once with mflux-save). Quantising at load time first loads full precision:
#    Z-Image-Turbo peaked at 25 GB that way, on a 24 GB Mac, and swapped. From the saved 8-bit copy:
#    7.5 GB, 32 s an image.
#  - It writes <file>.gen.json next to the image: model, licence class, prompt, seed, size, the full
#    command, the mflux version and the date, so the image can be made again (or remade with another
#    model if the game's terms ever change).
set -eu
DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODELS="${TRADECRAFT_CACHE:-$HOME/Library/Caches/tradecraft}/models"
BIN="$HOME/.local/bin"

usage() { sed -n '4,8p' "$0" | sed 's/^# *//'; exit 1; }
[ $# -ge 1 ] || usage
MODEL=$1; shift
OUT=""; PROMPT=""; SEED=""; Q=8; ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT=$2; shift 2 ;;
    --prompt) PROMPT=$2; ARGS+=(--prompt "$2"); shift 2 ;;
    --seed) SEED=$2; ARGS+=(--seed "$2"); shift 2 ;;
    --q) Q=$2; shift 2 ;;
    --) shift; ARGS+=("$@"); break ;;
    *) ARGS+=("$1"); shift ;;
  esac
done
[ -n "$OUT" ] && [ -n "$PROMPT" ] || usage
[ -n "$SEED" ] || { SEED=$((RANDOM * 32768 + RANDOM)); ARGS+=(--seed "$SEED"); }

case "$MODEL" in
  z-image-turbo)              CMD=mflux-generate-z-image-turbo; LIC="Apache-2.0: ships" ;;
  flux2-klein-4b)             CMD=mflux-generate-flux2;          LIC="Apache-2.0: ships" ;;
  flux2-klein-9b)             CMD=mflux-generate-flux2;          LIC="FLUX Non-Commercial v2.1 (hobby use): ships" ;;
  krea-2)                     CMD=mflux-generate-krea2;          LIC="Krea 2 Community: ships" ;;
  ideogram-4-fp8)             CMD=mflux-generate-ideogram4;      LIC="Ideogram Non-Commercial (hobby use): ships"; Q=none ;;
  qwen-image-2.1)             CMD=mflux-generate-qwen-2.1;       LIC="Qwen Research: SAMPLES ONLY, never ships" ;;
  *) echo "unknown model '$MODEL' (docs/PIPELINE.md lists the allowed ones)"; exit 1 ;;
esac

if [ "$Q" = none ]; then
  FROM=(--model "$MODEL")
else
  SAVED="$MODELS/$MODEL-q$Q"
  if [ ! -d "$SAVED" ]; then
    echo "saving a $Q-bit copy of $MODEL (once; the first time also downloads it)…"
    mkdir -p "$MODELS"
    "$BIN/mflux-save" --model "$MODEL" --quantize "$Q" --path "$SAVED" >/dev/null
  fi
  FROM=(--model "$SAVED" --base-model "$MODEL")
fi

mkdir -p "$(dirname "$OUT")"
start=$(date +%s)
"$BIN/$CMD" "${FROM[@]}" "${ARGS[@]}" --output "$OUT" 2>&1 | grep -E 'Peak|Error|error' || true
[ -f "$OUT" ] || { echo "no image written"; exit 1; }
secs=$(( $(date +%s) - start ))

python3 - "$OUT" "$MODEL" "$LIC" "$PROMPT" "$SEED" "$Q" "$secs" "$CMD" "${ARGS[@]}" <<'EOF'
import json, sys, datetime, subprocess, os
out, model, lic, prompt, seed, q, secs, cmd, *args = sys.argv[1:]
ver = subprocess.run([os.path.expanduser("~/.local/share/uv/tools/mflux/bin/python"), "-c",
                      "import importlib.metadata as m; print(m.version('mflux'))"], capture_output=True, text=True).stdout.strip()
side = os.path.splitext(out)[0] + ".gen.json"
json.dump({"model": model, "licence": lic, "prompt": prompt, "seed": int(seed), "quantize": q,
           "command": [cmd] + args, "mflux": ver, "seconds": int(secs),
           "date": datetime.date.today().isoformat()}, open(side, "w"), indent=1)
print(f"{out} ({secs} s) · {lic} · provenance in {side}")
EOF
