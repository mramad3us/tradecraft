#!/usr/bin/env bash
# TRADECRAFT: cut a release.
#
#   tools/release.sh patch "<summary>" [--trailer "Key: value"]... [--no-test]
#   tools/release.sh minor "<summary>" --user-validated [...]
#   tools/release.sh major "<summary>" --user-validated [...]
#
# One release, start to finish, so no step is forgotten:
#   1. the next version from VERSION (patch: 0.4.2 -> 0.4.3; minor: -> 0.5.0);
#   2. CHANGELOG.md's "## Unreleased" section becomes "## vX.Y.Z (date)", and
#      a fresh empty Unreleased goes above it (an empty Unreleased is refused:
#      every release says what it changed);
#   3. VERSION is written;
#   4. the tests run (QUICK=1 in the environment leaves out the heavy ones);
#   5. everything is committed as "vX.Y.Z: <summary>" with the trailers given,
#      and tagged vX.Y.Z (annotated, so --follow-tags pushes it);
#   6. pushed, if there is an origin.
# The play copy is not touched: promotion is tools/promote.sh, on the user's go.
#
# The minor and the major move only when the user has declared a release
# candidate and validated it; --user-validated is that, said out loud.
set -eu
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

usage() { sed -n '4,6p' "$0" | sed 's/^# *//'; exit 1; }
[ $# -ge 2 ] || usage
PART="$1"; SUMMARY="$2"; shift 2
TRAILERS=(); VALIDATED=0; TEST=1
while [ $# -gt 0 ]; do
  case "$1" in
    --trailer) TRAILERS+=(--trailer "$2"); shift 2 ;;
    --user-validated) VALIDATED=1; shift ;;
    --no-test) TEST=0; shift ;;
    *) echo "unknown option: $1"; usage ;;
  esac
done

OLD=$(tr -d '[:space:]' < VERSION)
IFS=. read -r MA MI PA <<< "$OLD"
case "$PART" in
  patch) PA=$((PA + 1)) ;;
  minor|major)
    if [ $VALIDATED = 0 ]; then
      echo "A $PART bump needs the user's validated release candidate (--user-validated). Patch releases need nothing."
      exit 1
    fi
    if [ "$PART" = minor ]; then MI=$((MI + 1)); else MA=$((MA + 1)); MI=0; fi
    PA=0 ;;
  *) usage ;;
esac
NEW="$MA.$MI.$PA"
TAG="v$NEW"
SUBJECT="$TAG: $SUMMARY"

if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then echo "$TAG already exists."; exit 1; fi
[ ${#SUBJECT} -le 72 ] || echo "note: the subject is ${#SUBJECT} characters; keep it under 72 and put the detail in CHANGELOG.md."

mkdir -p .run
cp VERSION .run/VERSION.bak; cp CHANGELOG.md .run/CHANGELOG.md.bak
restore() { cp .run/VERSION.bak VERSION; cp .run/CHANGELOG.md.bak CHANGELOG.md; }

# The Unreleased section must say something.
python3 - "$NEW" "$(date +%Y-%m-%d)" <<'EOF'
import re, sys
ver, day = sys.argv[1], sys.argv[2]
p = 'CHANGELOG.md'
s = open(p).read()
m = re.search(r'^## Unreleased[ \t]*\n(.*?)(?=^## |\Z)', s, re.S | re.M)
if not m or not m.group(1).strip():
    sys.exit('CHANGELOG.md: write what this release changes under "## Unreleased" first.')
s = s[:m.start()] + f'## Unreleased\n\n## v{ver} ({day})\n\n{m.group(1).strip()}\n\n' + s[m.end():]
open(p, 'w').write(s)
EOF
echo "$NEW" > VERSION

if [ $TEST = 1 ] && [ -f package.json ] && grep -q '"test"' package.json; then
  if ! npm test --silent; then
    restore
    echo "Tests failed; nothing released (VERSION and CHANGELOG.md put back)."
    exit 1
  fi
fi

git add -A
git commit -q -m "$SUBJECT" ${TRAILERS[@]+"${TRAILERS[@]}"}
git tag -a "$TAG" -m "$SUBJECT"
echo "released $TAG ($(git rev-parse --short HEAD))"

if git remote get-url origin >/dev/null 2>&1; then
  git push -q --follow-tags origin HEAD && echo "pushed to origin"
fi
tools/promote.sh --status | sed -n 1p
