#!/usr/bin/env bash
# TRADECRAFT: move the play copy to a release.
#
#   tools/promote.sh             the latest release
#   tools/promote.sh v0.3.2      a given release (an older one too, to go back)
#   tools/promote.sh --status    where the play copy is, and what is newer
#
# The play copy (.play/) is a git worktree on a detached release tag. It is
# what ./play.sh serves and what the user plays, so it moves only on the
# user's go. A reload of the page after a promotion picks up the new release
# whole (the server sends no-store); saves stay, since the origin is the same.
set -eu
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
PLAY="$DIR/.play"

latest() { git tag -l 'v*' --sort=-v:refname | head -1; }
current() { git -C "$PLAY" describe --tags --exact-match 2>/dev/null || git -C "$PLAY" rev-parse --short HEAD 2>/dev/null || echo none; }

if [ "${1:-}" = "--status" ]; then
  if [ -e "$PLAY/.git" ]; then echo "play copy: $(current)"; else echo "play copy: none"; fi
  echo "latest release: $(latest || true)"
  if [ -e "$PLAY/.git" ] && [ -n "$(latest)" ]; then
    newer=$(git log --oneline "$(git -C "$PLAY" rev-parse HEAD)..$(latest)" 2>/dev/null | grep -c . || true)
    echo "commits in the latest release not in the play copy: $newer"
  fi
  exit 0
fi

REF="${1:-$(latest)}"
if [ -z "$REF" ]; then echo "No release tags yet (tools/release.sh makes them)."; exit 1; fi
if ! git rev-parse -q --verify "$REF^{commit}" >/dev/null; then echo "No such release: $REF"; exit 1; fi

if [ -e "$PLAY/.git" ]; then
  if [ -n "$(git -C "$PLAY" status --porcelain)" ]; then
    echo "The play copy has local changes; it should never have any. Look before promoting:"
    git -C "$PLAY" status --short
    exit 1
  fi
  was=$(current)
  git -C "$PLAY" checkout -q --detach "$REF"
else
  was=none
  git worktree prune
  git worktree add -q --detach "$PLAY" "$REF"
fi
echo "play copy: $was -> $(current) ($(cat "$PLAY/VERSION" 2>/dev/null || echo '?')). Reload the game to pick it up."
