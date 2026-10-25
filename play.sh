#!/usr/bin/env bash
# TRADECRAFT: serve the game and open the browser.
#
#   ./play.sh          the play copy (.play/, the release you play) on :8100
#   ./play.sh --dev    the working tree, as it is right now, on :8101
#
# Two copies on two ports, on purpose. The play copy is a release pinned by
# tools/promote.sh: it changes only when promoted, so a game in progress never
# has its files changed underneath it while work goes on in the tree. And the
# browser keeps saves per origin, so the dev server's saves (tests, smoke runs)
# never touch the player's.
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
PLAY_PORT=8100
DEV_PORT=8101

if [ "${1:-}" = "--dev" ]; then
  ROOT="$DIR"; PORT=$DEV_PORT; WHAT="working tree"
else
  ROOT="$DIR/.play"; PORT=$PLAY_PORT; WHAT="play copy"
  if [ ! -e "$ROOT/.git" ]; then
    echo "No play copy yet. Promote a release first: tools/promote.sh (or ./play.sh --dev for the working tree)."
    exit 1
  fi
fi

VERSION=$(cat "$ROOT/VERSION" 2>/dev/null || echo '?')
mkdir -p "$DIR/.run"
PIDFILE="$DIR/.run/serve-$PORT.pid"

# Stop our own earlier server on this port, and only ours: another project's
# server (longhaul's on :8090, say) is none of our business.
if [ -f "$PIDFILE" ]; then
  kill "$(cat "$PIDFILE")" 2>/dev/null && sleep 0.3
  rm -f "$PIDFILE"
fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is taken by something else:"
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN
  exit 1
fi

python3 "$DIR/tools/serve.py" "$PORT" "$ROOT" &>/dev/null &
SERVER_PID=$!
echo "$SERVER_PID" > "$PIDFILE"
echo "TRADECRAFT v$VERSION ($WHAT) on http://localhost:$PORT  (server pid $SERVER_PID, Ctrl+C to stop)"

sleep 0.5
open "http://localhost:$PORT"

trap 'kill $SERVER_PID 2>/dev/null; rm -f "$PIDFILE"; echo; echo "Server stopped."; exit 0' INT TERM
wait $SERVER_PID
rm -f "$PIDFILE"
