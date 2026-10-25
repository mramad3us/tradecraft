#!/usr/bin/env bash
# TRADECRAFT: fetch CMU motion-capture clips (BVH) into the local cache.
#
#   tools/fetch-cmu.sh 07_01 17_03 18_08      (ids: subject_trial)
#   tools/fetch-cmu.sh --find "walk stealth"  (search the index: every word must match)
#
# The CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu): "free for use in research and
# commercial projects worldwide"; credit in CREDITS.md. These are cgspeed's BVH conversions (made
# for MotionBuilder: a T-pose rest and bone names MPFB's cmu_mb skeleton shares), from the GitHub
# copy Shriinivas/cmubvh. Downloads are data: only unzipped and read, never run. Each clip lands in
# ~/Library/Caches/tradecraft/cmu/bvh/<id>.bvh; person.py --motions finds them there.
set -eu
CACHE="${TRADECRAFT_CACHE:-$HOME/Library/Caches/tradecraft}/cmu"
RAW=https://raw.githubusercontent.com/Shriinivas/cmubvh/main
mkdir -p "$CACHE/zip" "$CACHE/bvh"

index() {
  [ -s "$CACHE/index.txt" ] || curl -sfL -o "$CACHE/index.txt" "$RAW/cmu-mocap-index-text.txt"
  grep -E '^[0-9]{2,3}_[0-9]{2}' "$CACHE/index.txt"
}

if [ "${1:-}" = "--find" ]; then
  shift; out=$(index)
  for w in $*; do out=$(echo "$out" | grep -i -- "$w" || true); done
  echo "$out"; exit 0
fi
[ $# -gt 0 ] || { sed -n '4,5p' "$0" | sed 's/^# *//'; exit 1; }

for id in "$@"; do
  [ -s "$CACHE/bvh/$id.bvh" ] && { echo "$id: cached"; continue; }
  subject=${id%%_*}; n=$((10#$subject))
  # The repository groups subjects in folders named Sequence-<first>-<last>.
  [ -s "$CACHE/sequences.txt" ] || curl -sf https://api.github.com/repos/Shriinivas/cmubvh/contents \
    | python3 -c "import json,sys; [print(e['name']) for e in json.load(sys.stdin) if e['name'].startswith('Sequence-')]" > "$CACHE/sequences.txt"
  seq=$(awk -F- -v n=$n '{ if (n >= $2+0 && n <= $3+0) print $0 }' "$CACHE/sequences.txt")
  [ -n "$seq" ] || { echo "$id: no sequence folder for subject $subject"; continue; }
  curl -sfL -o "$CACHE/zip/$id.zip" "$RAW/$seq/$subject/Data/$id.zip" || { echo "$id: download failed"; continue; }
  tmp=$(mktemp -d); unzip -q -o -d "$tmp" "$CACHE/zip/$id.zip"
  f=$(find "$tmp" -name '*.bvh' | head -1)
  [ -n "$f" ] && mv "$f" "$CACHE/bvh/$id.bvh"; rm -rf "$tmp"
  echo "$id: $(grep -m1 -E "^$id" <(index) | cut -f2)  ($(grep -m1 'Frames:' "$CACHE/bvh/$id.bvh" | tr -d '\r'))"
done
